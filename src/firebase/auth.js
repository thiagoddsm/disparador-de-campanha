import { auth, db } from './config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';

export const DEFAULT_TENANT_ID = 'tenant_main';

/**
 * Busca ou cria o documento do perfil do usuário na coleção 'users'.
 * @param {import('firebase/auth').User} firebaseUser 
 * @returns {Promise<Object>}
 */
export async function syncUserProfile(
  firebaseUser, 
  defaultRole = 'member', 
  defaultTeam = null, 
  coordinatorData = null,
  tenantId = DEFAULT_TENANT_ID
) {
  if (!firebaseUser) return null;

  const isSuperAdmin = (firebaseUser.email || '').toLowerCase() === 'thiagoddsm@gmail.com';
  const userRef = doc(db, 'users', firebaseUser.uid);
  
  let snap = null;
  try {
    snap = await getDoc(userRef);
  } catch (e) {
    console.warn('Erro ao ler perfil no Firestore:', e);
  }

  if (snap && snap.exists()) {
    const data = snap.data();
    
    if (isSuperAdmin) {
      if (!data.is_active || data.role !== 'admin') {
        updateDoc(userRef, { is_active: true, role: 'admin' }).catch(() => {});
      }
      return { 
        uid: snap.id, 
        tenant_id: data.tenant_id || tenantId, 
        ...data, 
        role: 'admin', 
        is_active: true,
        name: data.name || 'Thiago Moura'
      };
    }

    if (data.is_active === false) {
      throw new Error('Seu acesso está desativado. Fale com um administrador.');
    }

    return { uid: snap.id, tenant_id: data.tenant_id || tenantId, ...data };
  }

  // Se não encontrou por UID, verifica se existe pré-cadastro pelo e-mail
  let preProfile = null;
  try {
    const qEmail = query(collection(db, 'users'), where('email', '==', firebaseUser.email.toLowerCase()));
    const emailSnap = await getDocs(qEmail);
    if (!emailSnap.empty) {
      preProfile = emailSnap.docs[0].data();
    }
  } catch (err) {
    console.warn('Erro ao verificar pré-cadastro:', err);
  }

  // Novo perfil cadastrado (ou mesclado com pré-cadastro)
  const newProfile = {
    uid: firebaseUser.uid,
    tenant_id: tenantId,
    name: firebaseUser.displayName || preProfile?.name || (isSuperAdmin ? 'Thiago Moura' : firebaseUser.email.split('@')[0]),
    email: firebaseUser.email.toLowerCase(),
    role: isSuperAdmin ? 'admin' : (preProfile?.role || defaultRole),
    team_id: isSuperAdmin ? null : (preProfile?.team_id || defaultTeam),
    team_name: preProfile?.team_name || null,
    coordinator_uid: preProfile?.coordinator_uid || (coordinatorData ? coordinatorData.uid : null),
    coordinator_name: preProfile?.coordinator_name || (coordinatorData ? coordinatorData.name : null),
    avatar_url: firebaseUser.photoURL || preProfile?.avatar_url || null,
    daily_goal: preProfile?.daily_goal || 30,
    contacts_opened: 0,
    messages_sent: 0,
    is_active: true,
    last_active_at: new Date().toISOString(),
    created_at: serverTimestamp()
  };

  try {
    await setDoc(userRef, newProfile);
  } catch (e) {
    console.warn('Erro ao gravar novo perfil no Firestore:', e);
  }

  return newProfile;
}

/**
 * Busca a lista de coordenadores cadastrados no tenant.
 */
export async function getAvailableCoordinators(tenantId = DEFAULT_TENANT_ID) {
  const q = query(collection(db, 'users'), where('role', 'in', ['coordinator', 'admin']));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * Busca a lista de equipes cadastradas no tenant.
 */
export async function getAvailableTeams(tenantId = DEFAULT_TENANT_ID) {
  const snap = await getDocs(collection(db, 'teams'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Cria diretamente um perfil de usuário no Firestore (Admin ou Coordenador criando membros).
 * Não altera a sessão do usuário atualmente logado.
 */
export async function createUserProfileDirectly({
  email,
  name,
  role = 'member',
  teamId = 'team_alpha',
  coordinatorData = null,
  dailyGoal = 30,
  tenantId = DEFAULT_TENANT_ID
}) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('E-mail é obrigatório para cadastrar um usuário.');

  const generatedUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userRef = doc(db, 'users', generatedUid);

  const profileData = {
    uid: generatedUid,
    tenant_id: tenantId,
    name: name || cleanEmail.split('@')[0],
    email: cleanEmail,
    role,
    team_id: teamId,
    coordinator_uid: coordinatorData ? coordinatorData.uid : null,
    coordinator_name: coordinatorData ? coordinatorData.name : null,
    avatar_url: null,
    daily_goal: Number(dailyGoal) || 30,
    contacts_opened: 0,
    messages_sent: 0,
    is_active: true,
    created_at: serverTimestamp(),
    created_at_iso: new Date().toISOString()
  };

  try {
    await setDoc(userRef, profileData);
  } catch (e) {
    console.warn('Erro ao salvar usuário no Firestore:', e);
  }

  // Notifica o app de que um novo membro foi adicionado
  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true, uid: generatedUid, ...profileData };
}

/**
 * Autentica com e-mail e senha.
 */
export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return await syncUserProfile(credential.user);
}

/**
 * Registra uma conta pendente. A atribuição de papel é administrativa.
 */
export async function registerWithEmail(
  email, 
  password, 
  name, 
  role = 'member', 
  teamId = 'team_alpha', 
  coordinatorData = null,
  tenantId = DEFAULT_TENANT_ID
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  return await syncUserProfile(credential.user, 'member', null, null, tenantId);
}

/**
 * Envia e-mail de recuperação de senha.
 */
export async function resetUserPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Encerra a sessão do usuário.
 */
export async function logoutUser() {
  await firebaseSignOut(auth);
}

/**
 * Hook / Observador de Autenticação com Roteamento Protegido.
 */
export function useAuth(callback) {
  callback({ user: null, loading: true, error: null });

  let unsubDoc = null;

  const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    if (unsubDoc) {
      unsubDoc();
      unsubDoc = null;
    }

    if (!firebaseUser) {
      callback({ user: null, loading: false, error: null });
      return;
    }

    try {
      const initialProfile = await syncUserProfile(firebaseUser);
      callback({ user: initialProfile, loading: false, error: null });

      // Escuta mudanças de equipe/cargo/status em tempo real
      const userRef = doc(db, 'users', firebaseUser.uid);
      unsubDoc = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const isSuperAdmin = (firebaseUser.email || '').toLowerCase() === 'thiagoddsm@gmail.com';
          const updatedProfile = {
            uid: snap.id,
            tenant_id: data.tenant_id || DEFAULT_TENANT_ID,
            ...data,
            role: isSuperAdmin ? 'admin' : (data.role || 'member'),
            is_active: isSuperAdmin ? true : (data.is_active !== false)
          };
          callback({ user: updatedProfile, loading: false, error: null });
        }
      }, (err) => {
        console.warn('Erro ao escutar atualizações de perfil:', err);
      });
    } catch (err) {
      console.error('Erro no useAuth:', err);
      callback({ user: null, loading: false, error: err.message });
    }
  });

  return () => {
    if (unsubDoc) unsubDoc();
    unsubAuth();
  };
}

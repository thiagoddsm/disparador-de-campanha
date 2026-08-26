import { auth, db } from './config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';

export const DEFAULT_TENANT_ID = 'tenant_main';

/**
 * Busca ou cria o documento do perfil do usuário na coleção 'users'.
 * @param {import('firebase/auth').User} firebaseUser 
 * @returns {Promise<Object>}
 */
export async function syncUserProfile(
  firebaseUser, 
  defaultRole = 'member', 
  defaultTeam = 'team_alpha', 
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

  // Novo perfil cadastrado
  const newProfile = {
    uid: firebaseUser.uid,
    tenant_id: tenantId,
    name: firebaseUser.displayName || (isSuperAdmin ? 'Thiago Moura' : firebaseUser.email.split('@')[0]),
    email: firebaseUser.email,
    role: isSuperAdmin ? 'admin' : defaultRole,
    team_id: defaultTeam,
    coordinator_uid: coordinatorData ? coordinatorData.uid : null,
    coordinator_name: coordinatorData ? coordinatorData.name : null,
    avatar_url: firebaseUser.photoURL || null,
    daily_goal: 30,
    contacts_opened: 0,
    messages_sent: 0,
    is_active: true,
    last_active_at: new Date().toISOString(),
    created_at: serverTimestamp()
  };

  try {
    await setDoc(userRef, newProfile);
  } catch (e) {
    console.warn('Erro ao gravar novo perfil:', e);
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
  throw new Error('A criação de contas por terceiros exige uma função administrativa segura. Use o cadastro individual e aprove o perfil no painel administrativo.');
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

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback({ user: null, loading: false, error: null });
      return;
    }

    try {
      const profile = await syncUserProfile(firebaseUser);
      callback({ user: profile, loading: false, error: null });
    } catch (err) {
      console.error('Erro no useAuth:', err);
      callback({ user: null, loading: false, error: err.message });
    }
  });
}

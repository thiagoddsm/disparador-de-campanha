import { auth, db, storage } from './config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const DEFAULT_TENANT_ID = 'tenant_main';

// Garante persistência permanente da sessão no navegador (LocalStorage / IndexedDB)
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Falha ao configurar browserLocalPersistence:', err);
  });
} catch (e) {}

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

  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data();

    if (data.is_active === false) {
      throw new Error('Seu acesso está desativado. Fale com um administrador.');
    }

    let teamName = data.team_name || null;
    if (data.team_id && (!teamName || teamName === data.team_id)) {
      try {
        const teamDoc = await getDoc(doc(db, 'teams', data.team_id));
        if (teamDoc.exists()) {
          teamName = teamDoc.data().name;
          updateDoc(userRef, { team_name: teamName }).catch(() => {});
        }
      } catch (e) {}
    }

    return { uid: snap.id, tenant_id: data.tenant_id || tenantId, ...data, team_name: teamName };
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

  let initialTeamId = preProfile?.team_id || defaultTeam;
  let initialTeamName = preProfile?.team_name || null;
  if (initialTeamId && !initialTeamName) {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', initialTeamId));
      if (teamDoc.exists()) {
        initialTeamName = teamDoc.data().name;
      }
    } catch (e) {}
  }

  // Novo perfil cadastrado (ou mesclado com pré-cadastro)
  const newProfile = {
    uid: firebaseUser.uid,
    tenant_id: tenantId,
    name: firebaseUser.displayName || preProfile?.name || firebaseUser.email.split('@')[0],
    email: firebaseUser.email.toLowerCase(),
    role: preProfile?.role || defaultRole,
    team_id: initialTeamId,
    team_name: initialTeamName,
    coordinator_uid: preProfile?.coordinator_uid || (coordinatorData ? coordinatorData.uid : null),
    coordinator_name: preProfile?.coordinator_name || (coordinatorData ? coordinatorData.name : null),
    avatar_url: firebaseUser.photoURL || preProfile?.avatar_url || null,
    language: preProfile?.language || 'pt-BR',
    timezone: preProfile?.timezone || 'America/Sao_Paulo',
    daily_goal: preProfile?.daily_goal || 30,
    contacts_opened: 0,
    messages_sent: 0,
    is_active: true,
    last_active_at: new Date().toISOString(),
    created_at: serverTimestamp()
  };

  await setDoc(userRef, newProfile);
  return newProfile;
}

/**
 * Comprime e redimensiona a imagem do avatar no navegador (max 256x256).
 */
function compressAvatarImage(file, maxSize = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Falha ao processar arquivo de imagem.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Faz upload da foto de perfil no Firebase Storage e retorna o link público.
 * Em caso de indisponibilidade do Storage, usa Base64 otimizado com segurança.
 * @param {File} file Arquivo de imagem selecionado pelo usuário
 * @param {string} userUid UID do usuário
 * @returns {Promise<string>} Download URL ou Base64 Data URL
 */
export async function uploadUserAvatarFile(file, userUid) {
  if (!file) throw new Error('Nenhum arquivo selecionado.');
  if (!file.type.startsWith('image/')) throw new Error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, WEBP).');
  
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 5MB.');
  }

  // Comprime a imagem para tamanho leve de avatar (~15KB)
  const compressedBase64 = await compressAvatarImage(file, 256, 0.85);

  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `avatars/${userUid || auth.currentUser?.uid || 'user'}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (storageErr) {
    console.warn('Firebase Storage indisponível, usando avatar otimizado:', storageErr);
    return compressedBase64;
  }
}

/**
 * Atualiza configurações de perfil do usuário atual no Firestore e Auth.
 */
export async function updateUserProfileSettings({ name, photoURL, language, timezone }) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuário não autenticado.');

  const updates = {
    updated_at: serverTimestamp()
  };

  if (name !== undefined) updates.name = name;
  if (photoURL !== undefined) updates.avatar_url = photoURL;
  if (language !== undefined) updates.language = language;
  if (timezone !== undefined) updates.timezone = timezone;

  // Atualiza Firebase Auth se displayName ou photoURL foram alterados
  if (name !== undefined || photoURL !== undefined) {
    await updateProfile(currentUser, {
      displayName: name || currentUser.displayName,
      photoURL: photoURL !== undefined ? photoURL : currentUser.photoURL
    });
  }

  // Atualiza Firestore
  const userRef = doc(db, 'users', currentUser.uid);
  await updateDoc(userRef, updates);
  return true;
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
  teamId = null,
  coordinatorData = null,
  dailyGoal = 30,
  tenantId = DEFAULT_TENANT_ID
}) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('E-mail é obrigatório para cadastrar um usuário.');

  const generatedUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userRef = doc(db, 'users', generatedUid);

  let teamName = null;
  if (teamId) {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        teamName = teamDoc.data().name;
      }
    } catch (e) {}
  }

  const profileData = {
    uid: generatedUid,
    tenant_id: tenantId,
    name: name || cleanEmail.split('@')[0],
    email: cleanEmail,
    role,
    team_id: teamId,
    team_name: teamName,
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
 * Autentica com e-mail e senha com sessão persistente permanente.
 */
export async function loginWithEmail(email, password) {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {}
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
          const updatedProfile = {
            uid: snap.id,
            tenant_id: data.tenant_id || DEFAULT_TENANT_ID,
            ...data,
            role: data.role || 'member',
            is_active: data.is_active !== false
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

import { db } from './config.js';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';

export const DEFAULT_TENANT_ID = 'tenant_main';

/**
 * Escuta os membros da equipe específica do coordenador (Isolamento de Equipe).
 */
export function subscribeToTeamMembers(teamId, coordinatorUid, callback) {
  try {
    let q = collection(db, 'users');
    const unsub = onSnapshot(q, (snapshot) => {
      const allUsers = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));

      const validTeamMembers = allUsers.filter(u => {
        if (!u || (!u.email && !u.name)) return false;
        if (u.role === 'admin') return false; // Admin global não aparece na lista operacional
        if (!u.team_id || u.team_id === 'global' || u.team_id === 'none') return false;
        return true;
      });

      let filtered = [];
      if (teamId) {
        filtered = validTeamMembers.filter(m => m.team_id === teamId || (coordinatorUid && m.coordinator_uid === coordinatorUid));
      } else if (coordinatorUid) {
        filtered = validTeamMembers.filter(m => m.coordinator_uid === coordinatorUid);
      } else {
        filtered = validTeamMembers;
      }

      callback(filtered);
    }, (error) => {
      console.warn('Erro ao escutar membros da equipe:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de membros:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta todos os usuários (Exclusivo para o Painel do Admin Global).
 */
export function subscribeToAllUsers(callback) {
  try {
    const q = collection(db, 'users');
    const unsub = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
      callback(users);
    }, (error) => {
      console.warn('Erro ao escutar todos os usuários:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de usuários:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta todas as equipes do tenant.
 */
export function subscribeToTenantTeams(tenantId = DEFAULT_TENANT_ID, callback) {
  try {
    const q = collection(db, 'teams');
    const unsub = onSnapshot(q, (snapshot) => {
      const teams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(teams);
    }, (error) => {
      console.warn('Erro ao escutar equipes:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de equipes:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta os contatos da equipe (Painel do Coordenador).
 */
export function subscribeToTeamContacts(teamId, callback) {
  if (!teamId) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'contacts'), where('team_id', '==', teamId));
    const unsub = onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(contacts);
    }, (error) => {
      console.warn('Erro ao escutar contatos da equipe:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de contatos da equipe:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta apenas os contatos atribuídos ao operador logado.
 */
export function subscribeToOperatorContacts(userUid, callback) {
  if (!userUid) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'contacts'), where('assigned_to', '==', userUid));
    const unsub = onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(contacts);
    }, (error) => {
      console.warn('Erro ao escutar contatos do operador:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de contatos do operador:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta todos os contatos do tenant (Admin).
 */
export function subscribeToAllContacts(callback) {
  try {
    const q = collection(db, 'contacts');
    const unsub = onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(contacts);
    }, (error) => {
      console.warn('Erro ao escutar todos os contatos:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de todos os contatos:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta os logs de auditoria recentes.
 */
export function subscribeToAuditLogs(callback) {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('created_at', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(logs);
    }, (error) => {
      console.warn('Erro ao escutar logs de auditoria:', error);
      callback([]);
    });

    return unsub;
  } catch (err) {
    console.error('Falha ao inicializar listener de auditoria:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Grava um log de auditoria no Firestore.
 */
export async function recordSystemAuditLog({
  actor_uid,
  actor_name = 'Sistema',
  action,
  target_user_uid = null,
  metadata = {}
}) {
  if (!actor_uid) return;

  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor_uid,
      actor_name,
      action,
      target_user_uid,
      metadata,
      created_at: serverTimestamp(),
      created_at_iso: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Erro ao gravar log de auditoria no Firestore:', err);
  }
}

/**
 * Cria uma nova equipe no Firestore e vincula o Coordenador.
 */
export async function createTeamInFirestore({
  name,
  coordinatorUid,
  coordinatorName,
  tenantId = DEFAULT_TENANT_ID
}) {
  if (!name) throw new Error('Nome da equipe é obrigatório.');

  const teamData = {
    name,
    coordinator_uid: coordinatorUid || null,
    coordinator_name: coordinatorName || null,
    tenant_id: tenantId,
    status: 'ACTIVE',
    members_count: 0,
    created_at: serverTimestamp(),
    created_at_iso: new Date().toISOString()
  };

  const docRef = await addDoc(collection(db, 'teams'), teamData);

  // Se selecionou um coordenador, atualiza o perfil dele
  if (coordinatorUid) {
    const coordRef = doc(db, 'users', coordinatorUid);
    await updateDoc(coordRef, {
      team_id: docRef.id,
      team_name: name,
      updated_at: serverTimestamp()
    });
  }

  return { id: docRef.id, ...teamData };
}

/**
 * Remove uma equipe do Firestore e desvincula membros/contatos da equipe excluída.
 */
export async function deleteTeamFromFirestore(teamId) {
  if (!teamId) return;
  try {
    const teamRef = doc(db, 'teams', teamId);
    await deleteDoc(teamRef);

    // Desvincula usuários da equipe excluída
    const usersSnap = await getDocs(query(collection(db, 'users'), where('team_id', '==', teamId)));
    const batch = writeBatch(db);
    usersSnap.docs.forEach(uDoc => {
      batch.update(uDoc.ref, { team_id: null, team_name: null, updated_at: serverTimestamp() });
    });

    // Desvincula contatos da equipe excluída
    const contactsSnap = await getDocs(query(collection(db, 'contacts'), where('team_id', '==', teamId)));
    contactsSnap.docs.forEach(cDoc => {
      batch.update(cDoc.ref, { team_id: null, updated_at: serverTimestamp() });
    });

    await batch.commit();
  } catch (err) {
    console.warn('Erro ao excluir equipe do Firestore:', err);
    throw err;
  }
}

/**
 * Atualiza o Coordenador Líder de uma equipe.
 */
export async function updateTeamCoordinator(teamId, coordinatorUid, coordinatorName) {
  if (!teamId) return;
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, {
    coordinator_uid: coordinatorUid || null,
    coordinator_name: coordinatorName || null,
    updated_at: serverTimestamp()
  });

  if (coordinatorUid) {
    const coordRef = doc(db, 'users', coordinatorUid);
    await updateDoc(coordRef, {
      team_id: teamId,
      updated_at: serverTimestamp()
    });
  }
}

/**
 * Atualiza o cargo de um usuário no Firestore.
 */
export async function updateUserRole(userId, newRole) {
  if (!userId || !newRole) return;
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    role: newRole,
    updated_at: serverTimestamp()
  });
}

/**
 * Atualiza a equipe de um usuário no Firestore.
 */
export async function updateUserTeam(userId, newTeamId, newTeamName = null) {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    team_id: newTeamId || null,
    team_name: newTeamName || null,
    updated_at: serverTimestamp()
  });
}

/**
 * Ativa ou desativa um usuário no Firestore.
 */
export async function toggleUserActiveStatus(userId, currentStatus) {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    is_active: !currentStatus,
    updated_at: serverTimestamp()
  });
}

/**
 * Remove um usuário do Firestore.
 */
export async function deleteUserFromFirestore(userId) {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
}

/**
 * Atualiza a meta diária de contatos de um membro.
 */
export async function updateMemberGoal(memberUid, newGoal) {
  if (!memberUid) return;
  const userRef = doc(db, 'users', memberUid);
  await updateDoc(userRef, {
    daily_goal: Number(newGoal) || 30,
    updated_at: serverTimestamp()
  });
}

/**
 * Grava contatos em lote no Firestore utilizando writeBatch.
 * Divide automaticamente em lotes de 450 para respeitar o limite do Firestore (500).
 */
export async function saveContactsBatch(contacts, onProgress = null) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { success: true, count: 0 };
  }

  const BATCH_SIZE = 450;
  let savedCount = 0;
  const total = contacts.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = contacts.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(contact => {
      const docId = contact.id || `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const docRef = doc(db, 'contacts', docId);

      const contactData = {
        name: contact.name || 'Sem Nome',
        phone: contact.phone,
        email: contact.email || null,
        city: contact.city || null,
        neighborhood: contact.neighborhood || contact.bairro || null,
        bairro: contact.neighborhood || contact.bairro || null,
        tags: Array.isArray(contact.tags) ? contact.tags : [],
        team_id: contact.team_id || null,
        assigned_to: contact.assigned_to || null,
        assigned_to_name: contact.assigned_to_name || null,
        status: contact.status || 'pending', // 'pending' | 'opened' | 'user_confirmed' | 'api_delivered'
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      batch.set(docRef, contactData, { merge: true });
    });

    await batch.commit();
    savedCount += chunk.length;
    if (onProgress) onProgress(savedCount, total);
  }

  return { success: true, count: savedCount };
}

/**
 * Atualiza o status de um contato (ex: aberto no wa.me, ou confirmado envio).
 */
export async function updateContactStatus(contactId, newStatus, extraData = {}) {
  if (!contactId || !newStatus) return;
  const contactRef = doc(db, 'contacts', contactId);

  const updates = {
    status: newStatus,
    updated_at: serverTimestamp(),
    ...extraData
  };

  if (newStatus === 'opened') {
    updates.last_opened_at = serverTimestamp();
  } else if (newStatus === 'user_confirmed' || newStatus === 'confirmed') {
    updates.confirmed_at = serverTimestamp();
  }

  await updateDoc(contactRef, updates);
}

/**
 * Reatribui um contato para outro membro.
 */
export async function reassignContactInFirestore(contactId, newMemberUid, newMemberName = null) {
  if (!contactId || !newMemberUid) return;
  const contactRef = doc(db, 'contacts', contactId);
  await updateDoc(contactRef, {
    assigned_to: newMemberUid,
    assigned_to_name: newMemberName,
    updated_at: serverTimestamp()
  });
}

/**
 * Remove um contato do Firestore.
 */
export async function deleteContactFromFirestore(contactId) {
  if (!contactId) return;
  const contactRef = doc(db, 'contacts', contactId);
  await deleteDoc(contactRef);
}

/**
 * Salva um template de mensagem no Firestore.
 */
export async function saveTemplateInFirestore(templateId, templateData) {
  const docRef = doc(db, 'templates', templateId || `template_${Date.now()}`);
  await setDoc(docRef, {
    ...templateData,
    updated_at: serverTimestamp()
  }, { merge: true });
  return docRef.id;
}

/**
 * Exclui um template de mensagem no Firestore.
 */
export async function deleteTemplateFromFirestore(templateId) {
  if (!templateId) return;
  const docRef = doc(db, 'templates', templateId);
  await deleteDoc(docRef);
}

/**
 * Escuta os templates cadastrados no tenant.
 * Aceita tanto subscribeToTemplates(callback) quanto subscribeToTemplates(currentUser, callback).
 */
export function subscribeToTemplates(arg1, arg2) {
  const callback = typeof arg1 === 'function' ? arg1 : (typeof arg2 === 'function' ? arg2 : () => {});
  try {
    const q = collection(db, 'templates');
    const unsub = onSnapshot(q, (snapshot) => {
      const templates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(templates);
    }, (err) => {
      console.warn('Erro ao escutar templates:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('Falha ao inicializar templates:', e);
    callback([]);
    return () => {};
  }
}

/**
 * Escuta o histórico de mensagens enviadas (/messages) respeitando estritamente a hierarquia:
 * - Admin: Vê o histórico geral (todas as mensagens).
 * - Coordenador: Vê as mensagens da sua equipe (suas e dos membros da equipe).
 * - Líder / Membro da Equipe: Vê estritamente apenas o seu próprio histórico de envios (user_uid).
 *
 * @param {Object|string|null} filter - Objeto { role, teamId, userUid }, string teamId, ou null
 * @param {Function} callback
 */
export function subscribeToMessagesHistory(filter, callback) {
  try {
    const q = query(collection(db, 'messages'), limit(300));

    const unsub = onSnapshot(q, (snapshot) => {
      let msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (typeof filter === 'object' && filter !== null) {
        const { role, teamId, userUid } = filter;
        if (role === 'member' && userUid) {
          // Líder / Membro: Vê apenas os seus próprios envios
          msgs = msgs.filter(m => m.user_uid === userUid);
        } else if (role === 'coordinator') {
          // Coordenador: Vê envios da sua equipe ou disparados por ele próprio
          msgs = msgs.filter(m => (teamId && m.team_id === teamId) || m.user_uid === userUid);
        } else if (role === 'admin') {
          // Admin: Vê geral (ou filtra por equipe se especificado)
          if (teamId) {
            msgs = msgs.filter(m => m.team_id === teamId);
          }
        }
      } else if (typeof filter === 'string' && filter.trim().length > 0) {
        msgs = msgs.filter(m => m.team_id === filter || !m.team_id || m.team_id === 'team_global');
      }

      // Ordena por data decrescente (sent_at || confirmed_at || created_at || opened_at)
      msgs.sort((a, b) => {
        const getTime = (obj) => {
          if (obj?.sent_at?.toMillis) return obj.sent_at.toMillis();
          if (obj?.confirmed_at?.toMillis) return obj.confirmed_at.toMillis();
          if (obj?.created_at?.toMillis) return obj.created_at.toMillis();
          if (obj?.opened_at?.toMillis) return obj.opened_at.toMillis();
          if (obj?.created_at) return new Date(obj.created_at).getTime();
          return 0;
        };
        return getTime(b) - getTime(a);
      });
      callback(msgs);
    }, (err) => {
      console.warn('Erro ao escutar histórico de mensagens:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('Falha ao inicializar histórico:', e);
    callback([]);
    return () => {};
  }
}

/**
 * Reseta o status de um contato de volta para 'pending'.
 */
export async function resetContactStatus(contactId) {
  if (!contactId) return;
  const contactRef = doc(db, 'contacts', contactId);
  await updateDoc(contactRef, {
    status: 'pending',
    updated_at: serverTimestamp()
  });
}

/**
 * Reseta todos os contatos de uma equipe de volta para 'pending'.
 */
export async function resetTeamContactsStatus(teamId) {
  if (!teamId) return;
  const q = query(collection(db, 'contacts'), where('team_id', '==', teamId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(d.ref, {
      status: 'pending',
      updated_at: serverTimestamp()
    });
  });
  await batch.commit();
}


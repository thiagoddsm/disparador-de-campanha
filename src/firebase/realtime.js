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
  writeBatch,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';

export const DEFAULT_TENANT_ID = 'tenant_main';

/**
 * Escuta os membros da equipe específica do coordenador (Isolamento de Equipe).
 */
export function subscribeToTeamMembers(teamId, coordinatorUid, callback) {
  const notify = (fsMembers = []) => {
    const overrides = JSON.parse(localStorage.getItem('user_profile_overrides') || '{}');
    const local = JSON.parse(localStorage.getItem('campaign_members') || '[]');
    const map = new Map();
    local.forEach(m => map.set(m.uid, m));
    fsMembers.forEach(m => map.set(m.uid, { ...(map.get(m.uid) || {}), ...m }));
    
    map.forEach((u, uid) => {
      if (overrides[uid]) {
        if (overrides[uid].role) u.role = overrides[uid].role;
        if (overrides[uid].team_id !== undefined) u.team_id = overrides[uid].team_id;
      }
    });

    let all = Array.from(map.values()).filter(m => m && (m.email || m.name));
    let filtered = coordinatorUid 
      ? all.filter(m => m.coordinator_uid === coordinatorUid)
      : teamId 
      ? all.filter(m => m.team_id === teamId)
      : all.filter(m => m.role === 'member');
    
    callback(filtered.length > 0 ? filtered : all);
  };

  const onUpdate = () => notify([]);
  window.addEventListener('team-updated', onUpdate);

  try {
    let q = collection(db, 'users');
    const unsub = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
      notify(members);
    }, (error) => {
      notify([]);
    });

    return () => {
      window.removeEventListener('team-updated', onUpdate);
      unsub();
    };
  } catch (err) {
    notify([]);
    return () => {
      window.removeEventListener('team-updated', onUpdate);
    };
  }
}

/**
 * Escuta todos os usuários (Exclusivo para o Painel do Admin Global).
 */
export function subscribeToAllUsers(callback) {
  const notify = (fsUsers = []) => {
    const overrides = JSON.parse(localStorage.getItem('user_profile_overrides') || '{}');
    const local = JSON.parse(localStorage.getItem('campaign_members') || '[]');
    const map = new Map();
    local.forEach(u => map.set(u.uid, u));
    fsUsers.forEach(u => map.set(u.uid, { ...(map.get(u.uid) || {}), ...u }));
    
    map.forEach((u, uid) => {
      if (overrides[uid]) {
        if (overrides[uid].role) u.role = overrides[uid].role;
        if (overrides[uid].team_id !== undefined) u.team_id = overrides[uid].team_id;
      }
      if (u.email && u.email.toLowerCase() === 'thiagoddsm@gmail.com') {
        u.role = 'admin';
      }
    });

    const all = Array.from(map.values()).filter(u => u && (u.email || u.name));
    callback(all);
  };

  const onUpdate = () => notify([]);
  window.addEventListener('team-updated', onUpdate);

  try {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
      notify(users);
    }, (error) => {
      notify([]);
    });

    return () => {
      window.removeEventListener('team-updated', onUpdate);
      unsub();
    };
  } catch (err) {
    notify([]);
    return () => {
      window.removeEventListener('team-updated', onUpdate);
    };
  }
}

/**
 * Escuta todas as equipes do tenant.
 */
export function subscribeToTenantTeams(tenantId = DEFAULT_TENANT_ID, callback) {
  const notify = (fsTeams = []) => {
    const localTeams = JSON.parse(localStorage.getItem('campaign_teams') || '[]');
    const map = new Map();
    localTeams.forEach(t => map.set(t.id, t));
    fsTeams.forEach(t => map.set(t.id, { ...(map.get(t.id) || {}), ...t }));
    
    const all = Array.from(map.values()).filter(t => t && t.name);
    callback(all);
  };

  const onUpdate = () => notify([]);
  window.addEventListener('team-updated', onUpdate);

  try {
    const unsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      notify(teams);
    }, (error) => {
      notify([]);
    });

    return () => {
      window.removeEventListener('team-updated', onUpdate);
      unsub();
    };
  } catch (err) {
    notify([]);
    return () => {
      window.removeEventListener('team-updated', onUpdate);
    };
  }
}

/**
 * Escuta os contatos da equipe (Painel do Coordenador).
 */
export function subscribeToTeamContacts(teamId, callback) {
  try {
    const q = query(collection(db, 'contacts'), where('team_id', '==', teamId));
    return onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(contacts);
    }, (error) => {
      console.warn('Firestore team contacts offline:', error.message);
      const local = JSON.parse(localStorage.getItem('campaign_contacts') || '[]');
      callback(local.filter(c => c.team_id === teamId));
    });
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('campaign_contacts') || '[]');
    callback(local);
    return () => {};
  }
}

/**
 * Escuta contatos de um membro individual (Painel do Membro).
 */
export function subscribeToMemberContacts(userId, callback) {
  try {
    const q = query(collection(db, 'contacts'), where('assigned_to', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(contacts);
    }, (error) => {
      console.warn('Firestore member contacts offline:', error.message);
      const local = JSON.parse(localStorage.getItem('campaign_contacts') || '[]');
      callback(local.filter(c => c.assigned_to === userId));
    });
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('campaign_contacts') || '[]');
    callback(local.filter(c => c.assigned_to === userId));
    return () => {};
  }
}

/**
 * Escuta todos os contatos globais (Admin).
 */
export function subscribeToAllContacts(callback) {
  try {
    return onSnapshot(collection(db, 'contacts'), (snapshot) => {
      const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(contacts);
    }, (error) => {
      console.warn('Firestore all contacts offline:', error.message);
      const local = JSON.parse(localStorage.getItem('campaign_contacts') || '[]');
      callback(local);
    });
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('campaign_contacts') || '[]');
    callback(local);
    return () => {};
  }
}

/**
 * Escuta logs de auditoria do sistema (/audit_logs).
 */
export function subscribeToSystemAuditLogs(tenantId = DEFAULT_TENANT_ID, callback) {
  const notify = (fsLogs = []) => {
    const localLogs = JSON.parse(localStorage.getItem('campaign_audit_logs') || '[]');
    const map = new Map();
    localLogs.forEach(l => map.set(l.id || `${l.created_at_iso}_${l.action}`, l));
    fsLogs.forEach(l => map.set(l.id, l));
    const all = Array.from(map.values());
    callback(all.length > 0 ? all : localLogs);
  };

  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      notify(logs);
    }, (error) => {
      notify([]);
    });
  } catch (err) {
    notify([]);
    return () => {};
  }
}

/**
 * Registra um evento de auditoria no sistema.
 */
export async function recordSystemAuditLog({
  tenant_id = DEFAULT_TENANT_ID,
  team_id = null,
  actor_uid,
  actor_name,
  action,
  target_id = null,
  metadata = {}
}) {
  const logData = {
    tenant_id,
    team_id,
    actor_uid,
    actor_name: actor_name || 'Usuário',
    action,
    target_id,
    metadata,
    created_at_iso: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...logData,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Audit log armazenado no histórico local:', e.message);
  }

  const local = JSON.parse(localStorage.getItem('campaign_audit_logs') || '[]');
  local.unshift({ ...logData, timestamp: new Date().toISOString() });
  localStorage.setItem('campaign_audit_logs', JSON.stringify(local.slice(0, 50)));
}

/**
 * Cria uma nova equipe no Firestore (Admin).
 */
export async function createTeamInFirestore({ name, coordinatorUid, coordinatorName, tenantId = DEFAULT_TENANT_ID }) {
  const teamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const teamData = {
    id: teamId,
    tenant_id: tenantId,
    name,
    coordinator_uid: coordinatorUid,
    coordinator_name: coordinatorName,
    members_count: 0,
    total_contacts: 0,
    is_active: true,
    created_at: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'teams', teamId), teamData);
  } catch (e) {
    console.warn('Firestore cloud rules fallback, gravando equipe no estado local:', e.message);
  }

  // Sempre grava no cache de equipes local
  const local = JSON.parse(localStorage.getItem('campaign_teams') || '[]');
  const filtered = local.filter(t => t.id !== teamId);
  filtered.push(teamData);
  localStorage.setItem('campaign_teams', JSON.stringify(filtered));

  // Atualiza o coordenador no Firestore para vincular seu team_id e cargo
  if (coordinatorUid) {
    try {
      await updateDoc(doc(db, 'users', coordinatorUid), {
        team_id: teamId,
        role: 'coordinator'
      });
    } catch (e) {}

    const localMembers = JSON.parse(localStorage.getItem('campaign_members') || '[]');
    const member = localMembers.find(m => m.uid === coordinatorUid);
    if (member) {
      member.team_id = teamId;
      member.role = 'coordinator';
      localStorage.setItem('campaign_members', JSON.stringify(localMembers));
    }
  }

  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true, teamId };
}

/**
 * Atualiza o coordenador líder de uma equipe.
 */
export async function updateTeamCoordinator(teamId, newCoordinatorUid, newCoordinatorName) {
  try {
    await updateDoc(doc(db, 'teams', teamId), {
      coordinator_uid: newCoordinatorUid,
      coordinator_name: newCoordinatorName
    });
  } catch (e) {
    throw e;
  }
  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true };
}

/**
 * Atualiza a meta individual de um membro da equipe (Coordenador ou Admin).
 */
export async function updateMemberGoal(memberUid, newDailyGoal) {
  try {
    await updateDoc(doc(db, 'users', memberUid), {
      daily_goal: Number(newDailyGoal)
    });
  } catch (e) {
    throw e;
  }
  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true };
}

/**
 * Atualiza o cargo/papel de um usuário no Firestore com persistência garantida.
 */
export async function updateUserRole(userId, newRole) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: newRole
    });
  } catch (e) {
    console.warn('Erro ao atualizar cargo no Firestore, aplicando no estado local:', e.message);
  }

  // Grava override persistente
  const overrides = JSON.parse(localStorage.getItem('user_profile_overrides') || '{}');
  if (!overrides[userId]) overrides[userId] = {};
  overrides[userId].role = newRole;
  localStorage.setItem('user_profile_overrides', JSON.stringify(overrides));

  const local = JSON.parse(localStorage.getItem('campaign_members') || '[]');
  const target = local.find(m => m.uid === userId);
  if (target) {
    target.role = newRole;
  } else {
    local.push({ uid: userId, role: newRole });
  }
  localStorage.setItem('campaign_members', JSON.stringify(local));

  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true };
}

/**
 * Atualiza a equipe vinculada a um usuário.
 */
export async function updateUserTeam(userId, newTeamId) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      team_id: newTeamId
    });
  } catch (e) {
    console.warn('Erro ao atualizar equipe no Firestore, aplicando no estado local:', e.message);
  }

  // Grava override persistente
  const overrides = JSON.parse(localStorage.getItem('user_profile_overrides') || '{}');
  if (!overrides[userId]) overrides[userId] = {};
  overrides[userId].team_id = newTeamId;
  localStorage.setItem('user_profile_overrides', JSON.stringify(overrides));

  const local = JSON.parse(localStorage.getItem('campaign_members') || '[]');
  const target = local.find(m => m.uid === userId);
  if (target) {
    target.team_id = newTeamId;
  } else {
    local.push({ uid: userId, team_id: newTeamId });
  }
  localStorage.setItem('campaign_members', JSON.stringify(local));

  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true };
}

/**
 * Exclui um usuário do Firestore.
 */
export async function deleteUserFromFirestore(userId) {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (e) {
    console.warn('Erro ao deletar no Firestore, removendo localmente:', e.message);
  }

  const local = JSON.parse(localStorage.getItem('campaign_members') || '[]');
  const filtered = local.filter(m => m.uid !== userId);
  localStorage.setItem('campaign_members', JSON.stringify(filtered));

  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true };
}

/**
 * Reatribui um contato para outro membro da equipe (Coordenador).
 */
export async function reassignContactInTeam(contactId, newMemberUid, newMemberName) {
  try {
    await updateDoc(doc(db, 'contacts', contactId), {
      assigned_to: newMemberUid,
      assigned_to_name: newMemberName
    });
  } catch (e) {
    throw e;
  }
  window.dispatchEvent(new CustomEvent('contacts-updated'));
  return { success: true };
}

/**
 * Ativa ou Desativa um usuário (Admin).
 */
export async function toggleUserActiveStatus(userId, isActive) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      is_active: isActive
    });
  } catch (e) {
    throw e;
  }
  window.dispatchEvent(new CustomEvent('team-updated'));
  return { success: true };
}

/**
 * Adiciona um único contato no Firestore.
 */
export async function addContactToFirestore(contactData) {
  try {
    const docRef = await addDoc(collection(db, 'contacts'), {
      ...contactData,
      status: 'pending',
      created_at: serverTimestamp(),
      opened_at: null,
      confirmed_at: null
    });
    return { success: true, id: docRef.id };
  } catch (e) {
    throw e;
  }
}

/**
 * Importa múltiplos contatos em lote associando tenant_id e team_id.
 */
export async function importContactsBatchToFirestore(contactsList) {
  const BATCH_SIZE = 400;
  const batches = [];
  
  for (let i = 0; i < contactsList.length; i += BATCH_SIZE) {
    const chunk = contactsList.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(contact => {
      const contactRef = doc(collection(db, 'contacts'));
      batch.set(contactRef, {
        ...contact,
        id: contactRef.id,
        tenant_id: contact.tenant_id || DEFAULT_TENANT_ID,
        team_id: contact.team_id || 'team_alpha',
        status: 'pending',
        created_at: serverTimestamp(),
        opened_at: null,
        confirmed_at: null
      });
    });

    batches.push(batch.commit());
  }

  try {
    await Promise.all(batches);
  } catch (e) {
    throw e;
  }
  window.dispatchEvent(new CustomEvent('contacts-updated'));

  return { success: true, count: contactsList.length };
}

// Alias para retrocompatibilidade
export const subscribeToTeamProgress = subscribeToAllUsers;

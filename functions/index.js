const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

/**
 * Helper para validar se o requisitante tem privilégios de Admin
 */
async function verifyIsAdmin(context) {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'Requer autenticação.');
  }

  // Verifica Custom Claims
  if (context.auth.token.admin === true) return true;

  // Verifica documento no Firestore
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (userDoc.exists && userDoc.data().role === 'admin') {
    return true;
  }

  throw new HttpsError('permission-denied', 'Apenas Administradores podem executar esta ação.');
}

/**
 * Cria usuário no Firebase Auth com Custom Claims e perfil no Firestore
 */
exports.adminCreateUser = onCall(async (request) => {
  const { email, password, name, role = 'member', teamId = null, coordinatorData = null, dailyGoal = 30 } = request.data;

  if (!email || !password || !name) {
    throw new HttpsError('invalid-argument', 'E-mail, senha e nome são obrigatórios.');
  }

  // Apenas Admin ou Coordenador (criando membro na própria equipe) pode provisionar
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Requer autenticação.');
  }

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  const callerData = callerDoc.exists ? callerDoc.data() : {};
  const isCallerAdmin = callerData.role === 'admin' || request.auth.token.admin === true;
  const isCallerCoord = callerData.role === 'coordinator';

  if (!isCallerAdmin && (!isCallerCoord || role !== 'member')) {
    throw new HttpsError('permission-denied', 'Permissão insuficiente para criar este tipo de usuário.');
  }

  const targetTeamId = isCallerCoord ? callerData.team_id : teamId;

  try {
    // 1. Cria usuário no Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true
    });

    const uid = userRecord.uid;

    // 2. Define Custom Claims
    const customClaims = {
      admin: role === 'admin',
      coordinator: role === 'coordinator',
      member: role === 'member',
      team_id: targetTeamId || null
    };

    await auth.setCustomUserClaims(uid, customClaims);

    // 3. Salva perfil no Firestore
    const userProfile = {
      uid,
      name,
      email,
      role,
      team_id: targetTeamId || null,
      tenant_id: 'default_tenant',
      is_active: true,
      daily_goal: Number(dailyGoal) || 30,
      coordinator_data: coordinatorData || (isCallerCoord ? { uid: request.auth.uid, name: callerData.name || 'Coordenador' } : null),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(userProfile);

    // 4. Grava Log de Auditoria
    await db.collection('audit_logs').add({
      actor_uid: request.auth.uid,
      actor_name: callerData.name || 'Sistema',
      action: 'user_created',
      target_user_uid: uid,
      metadata: { email, name, role, team_id: targetTeamId },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, uid, message: 'Usuário criado com sucesso!' };
  } catch (err) {
    console.error('Erro em adminCreateUser:', err);
    throw new HttpsError('internal', err.message || 'Erro ao criar usuário.');
  }
});

/**
 * Atualiza Custom Claims e perfil no Firestore (ex: promoção de cargo ou troca de equipe)
 */
exports.adminUpdateUserRoleAndTeam = onCall(async (request) => {
  await verifyIsAdmin(request);

  const { targetUid, role, teamId, teamName } = request.data;
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'targetUid é obrigatório.');
  }

  try {
    const updateData = {
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const claims = {};

    if (role) {
      updateData.role = role;
      claims.admin = role === 'admin';
      claims.coordinator = role === 'coordinator';
      claims.member = role === 'member';
    }

    if (teamId !== undefined) {
      updateData.team_id = teamId;
      if (teamName) updateData.team_name = teamName;
      claims.team_id = teamId;
    }

    // Atualiza Custom Claims
    const currentClaims = (await auth.getUser(targetUid)).customClaims || {};
    await auth.setCustomUserClaims(targetUid, { ...currentClaims, ...claims });

    // Atualiza Firestore
    await db.collection('users').doc(targetUid).set(updateData, { merge: true });

    return { success: true, message: 'Cargo e claims atualizados com sucesso.' };
  } catch (err) {
    console.error('Erro em adminUpdateUserRoleAndTeam:', err);
    throw new HttpsError('internal', err.message);
  }
});
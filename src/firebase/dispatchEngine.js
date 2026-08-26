import { db } from './config.js';
import { 
  doc, 
  getDoc, 
  runTransaction, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { sendEvolutionTextMessage } from './evolutionApi.js';
import { recordSystemAuditLog, DEFAULT_TENANT_ID } from './realtime.js';

export const DispatchConfig = {
  activeStrategy: 'wa.me', // 'wa.me' | 'evolution_api'
  evolutionApi: {
    baseUrl: import.meta.env.VITE_EVOLUTION_API_BASE_URL || '',
    instanceName: import.meta.env.VITE_EVOLUTION_DEFAULT_INSTANCE || ''
  }
};

/**
 * Sanitiza o número de telefone garantindo formato internacional sem caracteres especiais.
 */
export function sanitizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const cleanDigits = rawPhone.toString().replace(/\D/g, '');
  if (!cleanDigits) return '';
  return cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
}

/**
 * Busca o template ativo no Firestore ou cache local.
 */
export async function getTemplateBody(templateId = 'default') {
  const templateRef = doc(db, 'templates', templateId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists() || !templateSnap.data().message_body) {
    throw new Error('Nenhum template ativo foi configurado. Salve um template antes de disparar.');
  }
  return templateSnap.data().message_body;
}

/**
 * Estratégia de Disparo Assistido via wa.me (Universal para todos os membros).
 */
export const WaMeStrategy = {
  name: 'wa.me',
  async execute({ contact, user, formattedPhone, personalizedMessage, messageId }) {
    const encodedMessage = encodeURIComponent(personalizedMessage);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    return { success: true, strategy: 'wa.me', messageId, whatsappUrl };
  }
};

/**
 * Estratégia de Disparo Automatizado via Evolution API (Exclusivo para Admin e Coordinator).
 */
export const EvolutionStrategy = {
  name: 'evolution_api',
  async execute({ contact, user, formattedPhone, personalizedMessage, messageId }) {
    if (user.role === 'member') {
      throw new Error('PERMISSAO_NEGADA: O motor de disparo via Evolution API é exclusivo para Coordenadores e Administradores.');
    }

    const activeStored = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_active_instance') : null;
    const instanceName = activeStored || (user.team_id ? `instancia_${user.team_id}` : (DispatchConfig.evolutionApi.instanceName || 'IBM'));
    const result = await sendEvolutionTextMessage({
      instanceName,
      to: formattedPhone,
      text: personalizedMessage
    });

    if (!result.success) {
      throw new Error(result.error || 'Falha no envio automatizado pela Evolution API.');
    }

    return { success: true, strategy: 'evolution_api', messageId, result };
  }
};

/**
 * Motor de Disparo Central (DispatchEngine).
 * Executa transação atômica de concorrência com runTransaction:
 * - Valida se status === 'pending'
 * - Transiciona para 'opened'
 * - Incrementa contacts_opened
 * - Registra log imutável de auditoria em /messages
 */
export async function executeDispatch({
  contactId,
  contactName,
  contactCompany,
  contactPhone,
  user,
  strategy = 'wa.me',
  templateId = 'default',
  templateBody = null
}) {
  const userId = user?.uid || 'guest_user';
  const teamId = user?.team_id || 'team_alpha';
  const tenantId = user?.tenant_id || DEFAULT_TENANT_ID;

  // 1. Prepara a mensagem
  const messageTemplate = (templateBody || '').trim() || await getTemplateBody(templateId);
  if (!messageTemplate) throw new Error('Digite uma mensagem antes de disparar.');
  const cleanName = contactName ? contactName.trim() : 'Prezado(a)';
  const cleanCompany = contactCompany ? contactCompany.trim() : 'sua empresa';

  let personalizedMessage = messageTemplate.replace(/\{nome\}/gi, cleanName);
  personalizedMessage = personalizedMessage.replace(/\{empresa\}/gi, cleanCompany);

  const formattedPhone = sanitizePhoneNumber(contactPhone);
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 2. Transação Atômica no Firestore (pending -> opened com prevenção de concorrência)
  try {
    await runTransaction(db, async (transaction) => {
      const contactRef = doc(db, 'contacts', contactId);
      const userRef = doc(db, 'users', userId);
      const messageRef = doc(db, 'messages', messageId);

      const contactSnap = await transaction.get(contactRef);

      if (contactSnap.exists()) {
        const contactData = contactSnap.data();
        if (contactData.status && contactData.status !== 'pending') {
          throw new Error('CONCURRENCY_ERROR: Este contato já está sendo trabalhado por outra pessoa.');
        }
      }

      // Transiciona contato para opened
      transaction.update(contactRef, {
        status: 'opened',
        opened_at: serverTimestamp(),
        last_message_id: messageId
      });

      // Incrementa contacts_opened do operador
      try {
        transaction.set(userRef, {
          contacts_opened: increment(1),
          last_active_at: serverTimestamp()
        }, { merge: true });
      } catch (e) {}

      // Registra log imutável na coleção /messages
      transaction.set(messageRef, {
        id: messageId,
        tenant_id: tenantId,
        team_id: teamId,
        contact_id: contactId,
        user_uid: userId,
        phone: formattedPhone,
        message_body: personalizedMessage,
        strategy: strategy,
        status: 'opened',
        opened_at: serverTimestamp(),
        confirmed_at: null,
        created_at: serverTimestamp()
      });
    });
  } catch (err) {
    throw new Error(err.message || 'Não foi possível registrar o disparo no Firestore.');
  }

  // Registra no log de auditoria
  recordSystemAuditLog({
    tenant_id: tenantId,
    team_id: teamId,
    actor_uid: userId,
    actor_name: user?.name,
    action: 'dispatch_opened',
    target_id: contactId,
    metadata: { strategy, phone: formattedPhone }
  });

  // 4. Execução da estratégia selecionada
  if (strategy === 'evolution_api') {
    return await EvolutionStrategy.execute({
      contact: { id: contactId, name: contactName, phone: formattedPhone },
      user,
      formattedPhone,
      personalizedMessage,
      messageId
    });
  }

  return await WaMeStrategy.execute({
    contact: { id: contactId, name: contactName, phone: formattedPhone },
    user,
    formattedPhone,
    personalizedMessage,
    messageId
  });
}

/**
 * Transição 2: opened -> user_confirmed
 * Acionada pelo botão "Confirmar Envio" após retorno do WhatsApp.
 * Incrementa messages_sent do operador.
 */
export async function confirmUserDispatch({ contactId, messageId, user }) {
  const userId = user?.uid || 'guest_user';
  const tenantId = user?.tenant_id || DEFAULT_TENANT_ID;
  const teamId = user?.team_id || 'team_alpha';

  try {
    await runTransaction(db, async (transaction) => {
      const contactRef = doc(db, 'contacts', contactId);
      const userRef = doc(db, 'users', userId);

      const contactSnap = await transaction.get(contactRef);
      if (contactSnap.exists()) {
        const data = contactSnap.data();
        if (data.status !== 'opened') {
          throw new Error('O contato deve estar no status opened para ser confirmado.');
        }
      }

      transaction.update(contactRef, {
        status: 'user_confirmed',
        confirmed_at: serverTimestamp()
      });

      try {
        transaction.set(userRef, {
          messages_sent: increment(1),
          last_active_at: serverTimestamp()
        }, { merge: true });
      } catch (e) {}
    });
  } catch (err) {
    throw new Error(err.message || 'Não foi possível confirmar o disparo no Firestore.');
  }

  // Registra no log de auditoria
  recordSystemAuditLog({
    tenant_id: tenantId,
    team_id: teamId,
    actor_uid: userId,
    actor_name: user?.name,
    action: 'dispatch_confirmed',
    target_id: contactId
  });

  return { success: true, status: 'user_confirmed' };
}

export const confirmMessageDelivery = confirmUserDispatch;

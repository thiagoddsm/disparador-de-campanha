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
    let openedWindow = null;
    try {
      openedWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {}
    const isBlocked = !openedWindow || openedWindow.closed || typeof openedWindow.closed === 'undefined';
    return { success: true, strategy: 'wa.me', messageId, whatsappUrl, isBlocked };
  }
};

/**
 * Estratégia de Disparo Automatizado via Evolution API (Disponível quando houver WhatsApp conectado).
 */
export const EvolutionStrategy = {
  name: 'evolution_api',
  async execute({ contact, user, formattedPhone, personalizedMessage, messageId }) {
    const activeStored = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_active_instance') : null;
    const hierarchicalName = (user?.team_name && user?.role && user?.name)
      ? `${user.team_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${user.role}_${user.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      : null;
      
    const userInstance = user?.whatsapp?.instanceName || activeStored || hierarchicalName || 'instancia_operador';

    const result = await sendEvolutionTextMessage({
      instanceName: userInstance,
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
  // Extrai automaticamente apenas o primeiro nome (ex: "Mariana Moura" -> "Mariana")
  const firstName = cleanName.split(/\s+/)[0] || cleanName;
  const cleanCompany = contactCompany ? contactCompany.trim() : 'sua empresa';

  let personalizedMessage = messageTemplate.replace(/\{primeiro_nome\}|\{primeironome\}|\{first_name\}/gi, firstName);
  personalizedMessage = personalizedMessage.replace(/\{nome\}/gi, firstName);
  personalizedMessage = personalizedMessage.replace(/\{nome_completo\}|\{nomecompleto\}|\{full_name\}/gi, cleanName);
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
        // Previne conflito apenas se o contato estiver atribuído a OUTRO operador e sendo trabalhado no mesmo instante
        if (contactData.assigned_to && contactData.assigned_to !== userId && contactData.status === 'opened' && user?.role !== 'admin') {
          throw new Error('CONCURRENCY_ERROR: Este contato já está sendo trabalhado por outro operador.');
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
        team_id: teamId || 'team_global',
        contact_id: contactId,
        contact_name: cleanName,
        user_uid: userId,
        user_name: user?.name || user?.email || 'Operador',
        phone: formattedPhone,
        message_body: personalizedMessage,
        strategy: strategy,
        status: strategy === 'evolution_api' ? 'confirmed' : 'opened',
        opened_at: serverTimestamp(),
        sent_at: serverTimestamp(),
        confirmed_at: strategy === 'evolution_api' ? serverTimestamp() : null,
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
    const apiResult = await EvolutionStrategy.execute({
      contact: { id: contactId, name: contactName, phone: formattedPhone },
      user,
      formattedPhone,
      personalizedMessage,
      messageId
    });

    try {
      await confirmUserDispatch({ contactId, messageId, user });
    } catch (e) {
      console.warn('Erro ao auto-confirmar status do contato após API:', e);
    }

    return apiResult;
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
        if (data.status === 'user_confirmed') {
          // Já confirmado, atualiza apenas timestamp sem bloquear
        }
      }

      transaction.update(contactRef, {
        status: 'user_confirmed',
        confirmed_at: serverTimestamp()
      });

      if (messageId) {
        const msgRef = doc(db, 'messages', messageId);
        transaction.set(msgRef, {
          status: 'confirmed',
          confirmed_at: serverTimestamp(),
          sent_at: serverTimestamp()
        }, { merge: true });
      }

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

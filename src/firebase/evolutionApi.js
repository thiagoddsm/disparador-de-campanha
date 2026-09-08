/**
 * Evolution API Client & Anti-Ban Safeguard Engine
 * Padrão corporativo inspirado na arquitetura FestaPay + Regras Anti-Ban Oiko
 */

import { db } from './config.js';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

export const EVOLUTION_CONFIG = {
  baseUrl: (import.meta.env.VITE_EVOLUTION_API_BASE_URL || 'https://api.ibmanha.com.br').replace(/\/$/, ''),
  apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || '554C767EA3D2-4221-AB6A-C126C68A657E',
  defaultInstance: import.meta.env.VITE_EVOLUTION_DEFAULT_INSTANCE || 'IBM',
  antiBan: {
    minDelayMs: 50000,      // Delay mínimo entre disparos (~50s)
    maxDelayMs: 70000,      // Delay máximo aleatório / Jitter (~70s -> média de 1 minuto por mensagem)
    typingSimulationMs: 2500, // Simulação de "Digitando..." antes de enviar
    batchCoolingEvery: 20,  // Pausa de resfriamento a cada 20 mensagens
    batchCoolingMs: 120000, // Pausa de 2 minutos
    enableSpintax: true     // Variação de sinônimos dinâmica
  }
};

let firestoreEvolutionConfig = null;

// Escuta em tempo real a configuração salva no Firestore pelo Admin
export function initEvolutionConfigListener() {
  try {
    const configRef = doc(db, 'integrations', 'evolution');
    onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        firestoreEvolutionConfig = snapshot.data();
        if (firestoreEvolutionConfig.apiKey) {
          localStorage.setItem('evolution_api_key', firestoreEvolutionConfig.apiKey);
        }
        if (firestoreEvolutionConfig.baseUrl) {
          localStorage.setItem('evolution_api_url', firestoreEvolutionConfig.baseUrl);
        }
      }
    }, (err) => {
      console.warn('Erro ao escutar config da Evolution API no Firestore:', err);
    });
  } catch (e) {
    console.warn('Falha ao inicializar listener de Evolution Config:', e);
  }
}

// Salva a configuração global da Evolution API no Firestore (Apenas Admin)
export async function saveEvolutionGlobalConfig(baseUrl, apiKey) {
  const cleanUrl = baseUrl.replace(/\/$/, '').trim();
  const cleanKey = apiKey.trim();
  
  const configRef = doc(db, 'integrations', 'evolution');
  await setDoc(configRef, {
    baseUrl: cleanUrl,
    apiKey: cleanKey,
    updatedAt: serverTimestamp()
  }, { merge: true });

  firestoreEvolutionConfig = { baseUrl: cleanUrl, apiKey: cleanKey };
  localStorage.setItem('evolution_api_url', cleanUrl);
  localStorage.setItem('evolution_api_key', cleanKey);
}

function getEvolutionConfig(customApiKey) {
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_url') : null;
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_key') : null;

  const apiKey = customApiKey || 
                 firestoreEvolutionConfig?.apiKey || 
                 localKey || 
                 EVOLUTION_CONFIG.apiKey || 
                 import.meta.env.VITE_EVOLUTION_API_KEY;
                 
  const baseUrl = firestoreEvolutionConfig?.baseUrl || 
                  localUrl || 
                  EVOLUTION_CONFIG.baseUrl || 
                  import.meta.env.VITE_EVOLUTION_API_BASE_URL;

  if (!baseUrl || !apiKey) {
    throw new Error('Integração Evolution API não configurada.');
  }
  return { apiKey: apiKey.trim(), baseUrl: baseUrl.replace(/\/$/, '').trim() };
}

/**
 * Fetch seguro para Evolution API com auto-recuperação (Self-Healing) em caso de 401 Unauthorized.
 */
export async function evolutionFetch(endpoint, options = {}, customApiKey = null) {
  let { apiKey, baseUrl } = getEvolutionConfig(customApiKey);
  
  const headers = {
    'apikey': apiKey,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let res;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });
  } catch (err) {
    throw err;
  }

  // Auto-recuperação em caso de 401 Unauthorized (se a chave no localStorage ou Firestore estiver desatualizada)
  if (res.status === 401 && apiKey !== EVOLUTION_CONFIG.apiKey) {
    console.warn(`[Evolution API] 401 Unauthorized com chave '${apiKey.slice(0, 6)}...'. Restaurando para Master Key do servidor.`);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('evolution_api_key', EVOLUTION_CONFIG.apiKey);
    }
    apiKey = EVOLUTION_CONFIG.apiKey;
    headers['apikey'] = apiKey;
    res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });
  }

  return res;
}

/**
 * Resolve variações de Spintax para que nenhuma mensagem tenha o mesmo hash.
 * Exemplo: "{Olá|Oi|Bom dia} {nome}!" -> "Bom dia Mariana!"
 */
export function resolveSpintax(text) {
  if (!text) return '';
  return text.replace(/\{([^{}]+)\}/g, (match, choices) => {
    // Se for placeholder conhecido {nome} ou {empresa}, preserva
    if (choices.toLowerCase() === 'nome' || choices.toLowerCase() === 'empresa') {
      return match;
    }
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
}

/**
 * Sanitiza o slug da instância (padrão FestaPay).
 */
export function sanitizeInstanceSlug(name, maxLength = 35) {
  return (name || 'instancia')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, maxLength);
}

/**
 * Gera o nome padronizado da instância no padrão: equipe_funcao_nome
 * Exemplo: alpha_coordenador_thiago
 */
export function generateHierarchicalInstanceName(teamName, role, userName) {
  const cleanTeam = sanitizeInstanceSlug(teamName || 'alpha', 15);
  const cleanRole = sanitizeInstanceSlug(role || 'coordenador', 15);
  const cleanName = sanitizeInstanceSlug((userName || 'usuario').split(' ')[0], 15);
  return `${cleanTeam}_${cleanRole}_${cleanName}`;
}

/**
 * Consulta o status de conexão da instância na Evolution API.
 */
export async function getEvolutionConnectionState(instanceName, customApiKey) {
  try {
    const res = await evolutionFetch(`/instance/connectionState/${instanceName}`, {
      method: 'GET'
    }, customApiKey);

    if (res.status === 404) return { instanceName, state: 'not_found' };
    if (!res.ok) return { instanceName, state: 'error' };

    const data = await res.json();
    const rawState = data.instance?.state || data.state || 'close';
    const state = rawState === 'open' ? 'open' : rawState === 'connecting' ? 'connecting' : 'close';

    return {
      instanceName,
      state,
      phoneNumber: data.instance?.owner || data.owner || undefined
    };
  } catch (error) {
    console.error(`[Evolution API] Erro ao consultar estado de ${instanceName}:`, error);
    return { instanceName, state: 'error' };
  }
}

/**
 * Cria a instância na Evolution API se não existir (com suporte a Baileys e QR Code).
 */
export async function createEvolutionInstanceIfNotExists(instanceName, customApiKey, phoneNumber = null, isQrCode = true) {
  try {
    const stateResult = await getEvolutionConnectionState(instanceName, customApiKey);
    if (stateResult.state !== 'not_found' && stateResult.state !== 'error') {
      return { success: true };
    }

    const { apiKey } = getEvolutionConfig(customApiKey);
    const payload = {
      instanceName,
      token: apiKey,
      qrcode: isQrCode,
      integration: 'WHATSAPP-BAILEYS'
    };
    if (phoneNumber) {
      payload.number = phoneNumber;
      if (!isQrCode) payload.qrcode = false;
    }

    const res = await evolutionFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, customApiKey);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, error: 'Chave de API (apikey) não autorizada no servidor Evolution API.' };
      }
      if (res.status !== 403 && !data.error?.includes('already in use') && !JSON.stringify(data).includes('already in use')) {
        return { success: false, error: data.message || `Erro HTTP ${res.status} ao criar instância.` };
      }
    }

    // Aplica a política de preservação de notificações imediatamente
    await applyNotificationPreservationSettings(instanceName, customApiKey);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Erro de rede ao criar instância.' };
  }
}

/**
 * Aplica a política de Preservação de Notificações no celular (Não ler mensagens / Não ficar online 24h).
 * Impede que a Evolution API marque mensagens recebidas como lidas e garanta que o celular receba notificações push.
 */
export async function applyNotificationPreservationSettings(instanceName, customApiKey) {
  const payload = {
    rejectCall: false,
    msgCall: '',
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false
  };

  try {
    // Rota padrão Evolution v1/v2: POST /settings/set/:instance
    let res = await evolutionFetch(`/settings/set/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, customApiKey);

    // Fallback: POST /instance/settings/:instance
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await evolutionFetch(`/instance/settings/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }, customApiKey);
    }

    const data = await res.json().catch(() => ({}));
    return { success: res.ok, data };
  } catch (err) {
    console.warn(`[Evolution API] Falha ao aplicar configurações de notificação para ${instanceName}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Aplica a preservação de notificações para todas as instâncias da rede em lote.
 */
export async function applyNotificationPreservationToAllInstances(instancesList, customApiKey) {
  const results = [];
  for (const inst of instancesList) {
    const name = typeof inst === 'string' ? inst : (inst.name || inst.whatsapp?.instanceName || inst.whatsapp_instance);
    if (name) {
      const res = await applyNotificationPreservationSettings(name, customApiKey);
      results.push({ instanceName: name, success: res.success });
    }
  }
  return results;
}

/**
 * Solicita o QR Code de pareamento da instância.
 */
export async function getEvolutionQrCode(instanceName, customApiKey) {
  try {
    let res = await evolutionFetch(`/instance/connect/${instanceName}`, {
      method: 'GET'
    }, customApiKey);

    if (res.status === 404) {
      const createRes = await createEvolutionInstanceIfNotExists(instanceName, customApiKey);
      if (createRes.success) {
        res = await evolutionFetch(`/instance/connect/${instanceName}`, {
          method: 'GET'
        }, customApiKey);
      } else {
        return { success: false, instanceName, error: createRes.error || 'Instância não encontrada e falha ao criá-la.' };
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, instanceName, error: 'Chave de API (apikey) não autorizada no servidor Evolution API.' };
      }
      return { success: false, instanceName, error: data.message || `Erro HTTP ${res.status}` };
    }

    const base64 = data.base64 || data.qrcode?.base64;
    const code = data.code || data.qrcode?.code;
    const pairingCode = data.pairingCode;
    const state = data.instance?.state || (base64 ? 'connecting' : 'unknown');

    return {
      success: true,
      instanceName,
      base64,
      code,
      pairingCode,
      state
    };
  } catch (error) {
    return { success: false, instanceName, error: error.message || 'Erro ao obter QR Code.' };
  }
}

/**
 * Solicita o Código de Pareamento (Pairing Code de 8 dígitos) por número de telefone.
 * @param {string} instanceName - Nome único da instância
 * @param {string} phoneNumber - Número de telefone com DDI e DDD (ex: 5521998901302)
 * @param {string} [customApiKey] - Chave opcional
 */
export async function getEvolutionPairingCode(instanceName, phoneNumber, customApiKey) {
  if (!phoneNumber) {
    return { success: false, error: 'Número de telefone é obrigatório para gerar o código de pareamento.' };
  }

  // Sanitiza o telefone garantindo formato internacional sem caracteres especiais
  const cleanDigits = phoneNumber.toString().replace(/\D/g, '');
  const cleanPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;

  try {
    // 1. Verifica se já está conectada
    const stateCheck = await getEvolutionConnectionState(instanceName, customApiKey);
    if (stateCheck.state === 'open') {
      return {
        success: false,
        instanceName,
        isAlreadyConnected: true,
        error: `Esta instância (${instanceName}) já está CONECTADA (🟢 Aberta) com o número ${stateCheck.phoneNumber || 'atual'}. Se deseja parear outro número, desconecte-a primeiro.`
      };
    }

    // Helper para extrair PIN de 8 dígitos de qualquer formato retornado pela Evolution v2
    function extractValidPairingPin(apiData) {
      if (!apiData) return null;
      const candidates = [
        apiData.pairingCode,
        apiData.pairing_code,
        apiData.pairing,
        apiData.qrcode?.pairingCode,
        apiData.qrcode?.pairing_code,
        typeof apiData === 'string' ? apiData : null
      ];

      for (const cand of candidates) {
        if (cand && typeof cand === 'string') {
          const clean = cand.trim().replace(/\s+/g, '');
          // Um Pairing Code válido do WhatsApp tem entre 6 e 12 caracteres e NUNCA contém @, vírgulas ou barras
          if (clean.length >= 6 && clean.length <= 12 && !clean.startsWith('2@') && !clean.startsWith('1@') && !clean.includes('@') && !clean.includes(',') && !clean.includes(';')) {
            if (clean.length === 8 && !clean.includes('-')) {
              return `${clean.slice(0, 4)}-${clean.slice(4)}`.toUpperCase();
            }
            return clean.toUpperCase();
          }
        }
      }
      return null;
    }

    // Função interna com polling e auto-recriação caso a instância não exista
    async function requestConnectWithPolling(maxAttempts = 5, delayMs = 1200) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await evolutionFetch(`/instance/connect/${instanceName}?number=${cleanPhone}`, {
            method: 'GET'
          }, customApiKey);

          if (res.status === 404) {
            // Se não encontrou, recria a instância no modo pairing
            await evolutionFetch(`/instance/create`, {
              method: 'POST',
              body: JSON.stringify({
                instanceName,
                qrcode: false,
                number: cleanPhone,
                integration: 'WHATSAPP-BAILEYS'
              })
            }, customApiKey);
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }

          const d = await res.json().catch(() => ({}));
          const pin = extractValidPairingPin(d);
          if (pin) {
            return { data: d, validPin: pin };
          }
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, delayMs));
          }
        } catch (e) {
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
      }
      return { data: {}, validPin: null };
    }

    // 2. Se a instância não existe, cria diretamente com qrcode: false e o número do celular
    if (stateCheck.state === 'not_found') {
      const createRes = await createEvolutionInstanceIfNotExists(instanceName, customApiKey, cleanPhone, false);
      if (!createRes.success) {
        return { success: false, instanceName, error: createRes.error || 'Falha ao criar instância na Evolution API.' };
      }
      await new Promise(r => setTimeout(r, 1200));
    }

    let { data, validPin } = await requestConnectWithPolling(3, 1000);

    // Se o pairingCode ainda não veio, recriamos a instância com qrcode: false para forçar o handshake correto
    if (!validPin) {
      console.log(`[Evolution API] Recriando ${instanceName} no modo Pairing Code (qrcode: false)...`);
      await evolutionFetch(`/instance/delete/${instanceName}`, { method: 'DELETE' }, customApiKey).catch(() => {});
      await new Promise(r => setTimeout(r, 800));

      await evolutionFetch(`/instance/create`, {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          qrcode: false,
          number: cleanPhone,
          integration: 'WHATSAPP-BAILEYS'
        })
      }, customApiKey).catch(() => {});

      await applyNotificationPreservationSettings(instanceName, customApiKey);
      await new Promise(r => setTimeout(r, 1500));

      const retryResult = await requestConnectWithPolling(4, 1200);
      data = retryResult.data;
      validPin = retryResult.validPin;
    }

    // Se após a chamada o estado for open, o WhatsApp já conectou
    if (data?.instance?.state === 'open' || data?.state === 'open') {
      return {
        success: false,
        instanceName,
        isAlreadyConnected: true,
        error: `A instância já está conectada no WhatsApp (${data.instance?.owner || 'chip ativo'}).`
      };
    }

    if (!validPin) {
      validPin = extractValidPairingPin(data);
    }

    if (!validPin) {
      const hasQr = !!(data?.base64 || data?.qrcode?.base64 || data?.code?.startsWith('2@'));
      return { 
        success: false, 
        instanceName, 
        isQrCodeOnly: hasQr,
        base64: data?.base64 || data?.qrcode?.base64 || null,
        error: hasQr 
          ? 'O servidor Evolution API gerou a conexão em formato de QR Code. Por favor, clique no botão "Gerar QR Code" ao lado para escanear com a câmera.' 
          : 'A API não retornou o código de pareamento. Verifique se o número de telefone está correto com DDD (Ex: 5521999998888).'
      };
    }

    return {
      success: true,
      instanceName,
      phoneNumber: cleanPhone,
      pairingCode: validPin,
      state: data?.instance?.state || 'connecting'
    };
  } catch (error) {
    console.error(`[Evolution API] Erro ao obter Pairing Code para ${instanceName}:`, error);
    return { success: false, instanceName, error: error.message || 'Erro de rede ao conectar por Pairing Code.' };
  }
}

/**
 * Gera o texto formatado do convite de conexão para a campanha.
 */
export function buildInviteNotificationText(leaderName, pairingCode) {
  const cleanName = leaderName ? leaderName.split(' ')[0] : 'Líder';
  const codeDisplay = pairingCode ? `👉 *${pairingCode}*` : '👉 _(Código enviado pelo coordenador)_';

  return `Olá líder *${cleanName}*, você foi convidado a se conectar ao sistema de Envio de Mensagens da campanha do *Alex Amarante*.\n\nÉ bem simples:\n1. Abra o *WhatsApp* no seu celular\n2. Vá em *Configurações* (ou *Aparelhos Conectados*) > *Conectar um aparelho*\n3. Toque na opção *"Conectar com número de telefone"* (ou _"Link with phone number instead"_)\n4. Digite este código de 8 dígitos:\n${codeDisplay}\n\nAssim que você digitar, seu WhatsApp ficará conectado automaticamente! Qualquer dúvida, estamos à disposição.`;
}

/**
 * Envia notificação de convite com o código de pareamento via WhatsApp.
 */
export async function sendSystemInviteNotification({
  targetPhone,
  leaderName,
  pairingCode,
  senderInstanceName,
  customApiKey
}) {
  const messageText = buildInviteNotificationText(leaderName, pairingCode);
  const cleanDigits = targetPhone.toString().replace(/\D/g, '');
  const formattedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;

  // Se houver uma instância remetente informada, tenta disparar via API
  if (senderInstanceName) {
    try {
      const sendResult = await sendEvolutionTextMessage({
        instanceName: senderInstanceName,
        to: formattedPhone,
        text: messageText,
        customApiKey
      });
      return {
        success: sendResult.success,
        messageText,
        formattedPhone,
        waMeUrl: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`,
        viaApi: true,
        apiResult: sendResult
      };
    } catch (e) {
      console.warn('Falha no envio via API da notificação, fallback para wa.me:', e);
    }
  }

  // Fallback / URL pronta para wa.me
  return {
    success: true,
    messageText,
    formattedPhone,
    waMeUrl: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`,
    viaApi: false
  };
}

/**
 * Desconecta a instância da Evolution API.
 */
export async function logoutEvolutionInstance(instanceName, customApiKey) {
  try {
    const res = await evolutionFetch(`/instance/logout/${instanceName}`, {
      method: 'DELETE'
    }, customApiKey);

    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) {
      return { success: false, error: data.message || 'Erro ao desconectar.' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Envia mensagem de texto via Evolution API aplicando regras Anti-Ban (Jitter + Presence).
 */
export async function sendEvolutionTextMessage({
  instanceName,
  to,
  text,
  customApiKey,
  options = {}
}) {
  const cleanPhone = to.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  // Aplica Spintax se habilitado
  const finalText = EVOLUTION_CONFIG.antiBan.enableSpintax ? resolveSpintax(text) : text;

  // Calcula Jitter aleatório para não disparar em ritmo de robô (Anti-Ban)
  const jitterMs = Math.floor(
    Math.random() * (EVOLUTION_CONFIG.antiBan.maxDelayMs - EVOLUTION_CONFIG.antiBan.minDelayMs) +
    EVOLUTION_CONFIG.antiBan.minDelayMs
  );

  const payload = {
    number: formattedPhone,
    text: finalText,
    options: {
      delay: jitterMs,
      presence: 'composing', // Simula digitando antes de enviar
      linkPreview: true,
      ...options
    }
  };

  try {
    const targetInst = instanceName || EVOLUTION_CONFIG.defaultInstance;
    const res = await evolutionFetch(`/message/sendText/${targetInst}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, customApiKey);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        instanceUsed: instanceName,
        error: data.response?.message || data.message || `Erro HTTP ${res.status}`
      };
    }

    return {
      success: true,
      messageId: data.key?.id || data.messageId,
      instanceUsed: instanceName,
      antiBanDelayUsedMs: jitterMs
    };
  } catch (error) {
    return {
      success: false,
      instanceUsed: instanceName,
      error: error.message || 'Erro de conexão com a Evolution API.'
    };
  }
}

/**
 * Exclui permanentemente uma instância da Evolution API.
 */
export async function deleteEvolutionInstance(instanceName, customApiKey) {
  if (!instanceName) return { success: false, error: 'Nome de instância inválido.' };

  try {
    const res = await evolutionFetch(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    }, customApiKey);

    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) {
      return { success: false, error: data.message || `Erro HTTP ${res.status} ao excluir instância.` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Erro ao comunicar com Evolution API.' };
  }
}

/**
 * Busca todas as instâncias cadastradas no servidor Evolution API.
 */
export async function fetchEvolutionInstances(customApiKey) {
  try {
    const res = await evolutionFetch('/instance/fetchInstances', {
      method: 'GET'
    }, customApiKey);

    if (!res.ok) {
      return { success: false, instances: [], error: `Erro HTTP ${res.status} ao buscar instâncias.` };
    }

    const data = await res.json().catch(() => ([]));
    const instances = Array.isArray(data) ? data : (data.instances || []);
    return {
      success: true,
      instances: instances.map(inst => ({
        name: inst.instance?.instanceName || inst.name || inst.instanceName,
        state: inst.instance?.state || inst.connectionStatus || inst.state || 'close',
        owner: inst.instance?.owner || inst.owner || null,
        updatedAt: inst.instance?.updatedAt || inst.updatedAt || new Date().toISOString()
      }))
    };
  } catch (error) {
    return { success: false, instances: [], error: error.message || 'Erro de rede ao buscar instâncias.' };
  }
}

/**
 * Varre e exclui instâncias desconectadas há mais de X dias da Evolution API.
 */
export async function cleanupDisconnectedInstances({ maxDisconnectedDays = 7, customApiKey } = {}) {
  const result = await fetchEvolutionInstances(customApiKey);

  if (!result.success) {
    return { success: false, count: 0, error: result.error };
  }

  const nowMs = Date.now();
  const maxInactiveMs = maxDisconnectedDays * 24 * 60 * 60 * 1000;
  const toDelete = [];

  for (const inst of result.instances) {
    // Não remove a instância padrão global se estiver em uso
    if (inst.name === EVOLUTION_CONFIG.defaultInstance) continue;

    // Se estiver desconectada (não 'open')
    if (inst.state !== 'open') {
      const lastUpdateMs = inst.updatedAt ? new Date(inst.updatedAt).getTime() : 0;
      const inactiveDuration = nowMs - lastUpdateMs;

      if (inactiveDuration >= maxInactiveMs || !inst.updatedAt) {
        toDelete.push(inst.name);
      }
    }
  }

  let deletedCount = 0;
  const errors = [];

  for (const instName of toDelete) {
    const delRes = await deleteEvolutionInstance(instName, customApiKey);
    if (delRes.success) {
      deletedCount++;
    } else {
      errors.push(`${instName}: ${delRes.error}`);
    }
  }

  return {
    success: true,
    deletedCount,
    totalScanned: result.instances.length,
    errors
  };
}

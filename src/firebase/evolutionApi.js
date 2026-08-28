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
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

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
export async function createEvolutionInstanceIfNotExists(instanceName, customApiKey) {
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  try {
    const stateResult = await getEvolutionConnectionState(instanceName, apiKey);
    if (stateResult.state !== 'not_found' && stateResult.state !== 'error') {
      return { success: true };
    }

    const res = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, error: 'Chave de API (apikey) não autorizada no servidor Evolution API.' };
      }
      if (res.status !== 403 && !data.error?.includes('already in use')) {
        return { success: false, error: data.message || `Erro HTTP ${res.status} ao criar instância.` };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Erro de rede ao criar instância.' };
  }
}

/**
 * Solicita o QR Code de pareamento da instância.
 */
export async function getEvolutionQrCode(instanceName, customApiKey) {
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  try {
    const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, instanceName, error: 'Chave de API (apikey) não autorizada no servidor Evolution API.' };
      }
      if (res.status === 404) {
        const createRes = await createEvolutionInstanceIfNotExists(instanceName, apiKey);
        if (createRes.success) {
          return await getEvolutionQrCode(instanceName, apiKey);
        } else {
          return { success: false, instanceName, error: createRes.error || 'Instância não encontrada e falha ao criá-la.' };
        }
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
 * Desconecta a instância da Evolution API.
 */
export async function logoutEvolutionInstance(instanceName, customApiKey) {
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  try {
    const res = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
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
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  // Formata telefone
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
    const res = await fetch(`${baseUrl}/message/sendText/${instanceName || EVOLUTION_CONFIG.defaultInstance}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

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
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  try {
    const res = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

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
  const { apiKey, baseUrl } = getEvolutionConfig(customApiKey);

  try {
    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return { success: false, instances: [], error: `Erro HTTP ${res.status} ao buscar instâncias.` };
    }

    const data = await res.json();
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
  const { apiKey } = getEvolutionConfig(customApiKey);
  const result = await fetchEvolutionInstances(apiKey);

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
    const delRes = await deleteEvolutionInstance(instName, apiKey);
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

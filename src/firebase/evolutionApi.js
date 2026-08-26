/**
 * Evolution API Client & Anti-Ban Safeguard Engine
 * Padrão corporativo inspirado na arquitetura FestaPay + Regras Anti-Ban Oiko
 */

export const EVOLUTION_CONFIG = {
  baseUrl: (import.meta.env.VITE_EVOLUTION_API_BASE_URL || 'https://api.ibmanha.com.br').replace(/\/$/, ''),
  apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || '554C767EA3D2-4221-AB6A-C126C68A657E',
  defaultInstance: import.meta.env.VITE_EVOLUTION_DEFAULT_INSTANCE || 'IBM',
  antiBan: {
    minDelayMs: 4000,       // Delay mínimo entre disparos (4s)
    maxDelayMs: 12000,      // Delay máximo aleatório / Jitter (12s)
    typingSimulationMs: 2500, // Simulação de "Digitando..." antes de enviar
    batchCoolingEvery: 25,  // Pausa de resfriamento a cada 25 mensagens
    batchCoolingMs: 180000, // Pausa de 3 minutos
    enableSpintax: true     // Variação de sinônimos dinâmica
  }
};

function getEvolutionConfig(customApiKey) {
  const apiKey = customApiKey || EVOLUTION_CONFIG.apiKey || import.meta.env.VITE_EVOLUTION_API_KEY;
  const baseUrl = EVOLUTION_CONFIG.baseUrl || import.meta.env.VITE_EVOLUTION_API_BASE_URL;
  if (!baseUrl || !apiKey) {
    throw new Error('Integração Evolution API não configurada.');
  }
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, '') };
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
export function sanitizeInstanceSlug(name) {
  return (name || 'instancia')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30);
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
    if (!res.ok && res.status !== 403 && !data.error?.includes('already in use')) {
      return { success: false, error: data.message || 'Erro ao criar instância na Evolution API.' };
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
      if (res.status === 404) {
        const createRes = await createEvolutionInstanceIfNotExists(instanceName, apiKey);
        if (createRes.success) {
          return await getEvolutionQrCode(instanceName, apiKey);
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

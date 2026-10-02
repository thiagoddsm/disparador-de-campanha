import { saveContactsBatch, subscribeToTenantTeams, subscribeToTeamMembers } from '../firebase/realtime.js';
import { showToast } from '../utils/feedback.js';

/**
 * Sanitiza e valida números de telefone brasileiros (E.164)
 */
function sanitizePhoneNumber(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Formata telefone para exibição
 */
function formatPhoneDisplay(phone) {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
  }
  if (clean.length === 13 && clean.startsWith('55')) {
    return `(${clean.substring(2, 4)}) ${clean.substring(4, 9)}-${clean.substring(9)}`;
  }
  return phone;
}

export function renderCsvImportWizard(container, currentUser, onNavigate) {
  let availableTeams = [];
  let teamMembers = [];
  const isMember = currentUser?.role === 'member';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isAdmin = currentUser?.role === 'admin';

  if (isMember) {
    container.innerHTML = `
      <div class="page-content">
        <div class="main-panel-card" style="padding: 3rem 2rem; text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: var(--radius-full); background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">Acesso Restrito ao Coordenador</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 480px; margin: 0.5rem auto 1.5rem auto;">
            A importação e distribuição de contatos em lote é uma atribuição do seu Coordenador ou do Administrador da campanha.
          </p>
          <button id="btn-back-to-contacts" class="btn-primary-blue" style="margin: 0 auto;">Voltar para Meus Contatos</button>
        </div>
      </div>
    `;
    container.querySelector('#btn-back-to-contacts')?.addEventListener('click', () => onNavigate('contacts'));
    return () => {};
  }

  // Baixar Modelo JSON de Exemplo
  function downloadJsonTemplate() {
    const sample = [
      {
        "nome": "Carlos Silva",
        "telefone": "21988887777",
        "cidade": "Rio de Janeiro",
        "bairro": "Copacabana",
        "lider": "Henrique Longobuco"
      },
      {
        "nome": "Mariana Souza",
        "telefone": "21977776666",
        "cidade": "Niterói",
        "bairro": "Icaraí",
        "lider": "Andre Felipe"
      },
      {
        "nome": "Roberto Oliveira",
        "telefone": "21966665555",
        "cidade": "São Gonçalo",
        "bairro": "Alcântara"
      },
      {
        "nome": "Juliana Santos",
        "telefone": "21955554444",
        "cidade": "Rio de Janeiro",
        "bairro": "Tijuca"
      },
      {
        "nome": "Fernando Costa",
        "telefone": "21944443333",
        "cidade": "Duque de Caxias",
        "bairro": "Centro"
      }
    ];

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sample, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "modelo_importacao_contatos.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Modelo JSON baixado com sucesso!', 'success');
  }

  // Baixar Modelo CSV de Exemplo
  function downloadCsvTemplate() {
    const sampleCsv = "Nome,Telefone,Cidade,Bairro,Lider\nCarlos Silva,21988887777,Rio de Janeiro,Copacabana,Henrique Longobuco\nMariana Souza,21977776666,Niterói,Icaraí,Andre Felipe\nRoberto Oliveira,21966665555,São Gonçalo,Alcântara,\nJuliana Santos,21955554444,Rio de Janeiro,Tijuca,\nFernando Costa,21944443333,Duque de Caxias,Centro,";

    const blob = new Blob(["\uFEFF" + sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", "modelo_importacao_contatos.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast('Modelo CSV baixado com sucesso!', 'success');
  }

  function renderStep1() {
    container.innerHTML = `
      <div class="page-content" style="max-width: 900px; margin: 0 auto; padding: 1.5rem;">
        
        <!-- Header com Título e Botões de Download de Modelo -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; margin: 0;">
              Importar Base de Contatos
            </h2>
            <p style="font-size: 0.88rem; color: #64748B; margin-top: 0.25rem;">
              Carregue a base de contatos de um líder ou equipe via arquivo <strong>JSON</strong> ou planilha <strong>CSV</strong>.
            </p>
          </div>

          <!-- Botões de Baixar Modelos -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" id="btn-download-json-template" class="btn-outline-white" style="font-size: 0.82rem; font-weight: 700; padding: 0.55rem 1rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.4rem; background: #FFFFFF; border: 1.5px solid #CBD5E1; color: #0F172A; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>📥 Baixar Modelo JSON</span>
            </button>

            <button type="button" id="btn-download-csv-template" class="btn-outline-white" style="font-size: 0.82rem; font-weight: 600; padding: 0.55rem 1rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.4rem; background: #FFFFFF; border: 1.5px solid #CBD5E1; color: #475569; cursor: pointer;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>📥 Baixar Modelo CSV</span>
            </button>
          </div>
        </div>

        <!-- Card de Upload / Dropzone -->
        <div class="main-panel-card" style="padding: 2.5rem 1.5rem; text-align: center; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          
          <div style="border: 2px dashed #94A3B8; border-radius: 12px; padding: 3rem 1.5rem; background: #F8FAFC; max-width: 620px; margin: 0 auto; cursor: pointer; transition: all 0.2s ease;" id="drop-zone">
            
            <div style="width: 58px; height: 58px; border-radius: 50%; background: #EFF6FF; color: #1D4ED8; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>

            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0F172A; margin: 0 0 0.4rem 0;">
              Selecione seu arquivo .JSON ou .CSV
            </h3>
            
            <p style="font-size: 0.88rem; color: #64748B; margin: 0 0 1.5rem 0;">
              ou arraste e solte o arquivo diretamente aqui
            </p>
            
            <input type="file" id="contact-file-input" accept=".json,.csv,.txt" style="display: none;">
            
            <button type="button" id="btn-browse-file" class="btn-primary-blue" style="margin: 0 auto; padding: 0.65rem 1.5rem; font-size: 0.9rem; font-weight: 700; border-radius: 8px; cursor: pointer;">
              Escolher Arquivo no Computador
            </button>
          </div>

          <!-- Dicas e Especificações de Formato -->
          <div style="margin-top: 2rem; display: flex; justify-content: center; gap: 2rem; font-size: 0.82rem; color: #64748B; flex-wrap: wrap;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <span style="color: #16A34A; font-weight: 700;">✓</span> <strong>JSON:</strong> Array de contatos ou objeto com lista
            </span>
            <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <span style="color: #16A34A; font-weight: 700;">✓</span> <strong>CSV:</strong> Separador vírgula (,) ou ponto-e-vírgula (;)
            </span>
            <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <span style="color: #16A34A; font-weight: 700;">✓</span> <strong>Telefones:</strong> Formato com ou sem DDD/55
            </span>
          </div>
        </div>

        <!-- Guia Rápido de Estrutura JSON -->
        <div style="margin-top: 1.5rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.25rem;">
          <h4 style="font-size: 0.88rem; font-weight: 800; color: #1E293B; margin: 0 0 0.5rem 0;">
            📋 Estrutura recomendada para o arquivo JSON:
          </h4>
          <pre style="background: #0F172A; color: #F8FAFC; padding: 0.85rem; border-radius: 8px; font-size: 0.78rem; overflow-x: auto; margin: 0; line-height: 1.4;">[
  {
    "nome": "Nome do Contato",
    "telefone": "21988887777",
    "cidade": "Rio de Janeiro",
    "bairro": "Copacabana",
    "lider": "Nome do Líder (Opcional)"
  }
]</pre>
        </div>

      </div>
    `;

    const fileInput = container.querySelector('#contact-file-input');
    const browseBtn = container.querySelector('#btn-browse-file');
    const dropZone = container.querySelector('#drop-zone');

    container.querySelector('#btn-download-json-template')?.addEventListener('click', downloadJsonTemplate);
    container.querySelector('#btn-download-csv-template')?.addEventListener('click', downloadCsvTemplate);

    browseBtn?.addEventListener('click', () => fileInput.click());
    dropZone?.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#1D4ED8';
      dropZone.style.background = '#EFF6FF';
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#94A3B8';
      dropZone.style.background = '#F8FAFC';
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#94A3B8';
      dropZone.style.background = '#F8FAFC';
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  function handleFile(file) {
    if (!file) return;
    if (file.size === 0) {
      showToast('O arquivo selecionado está vazio.', 'error');
      return;
    }

    const fileName = file.name.toLowerCase();
    const isJson = fileName.endsWith('.json');

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (isJson || content.trim().startsWith('[') || content.trim().startsWith('{')) {
        parseJsonContent(content);
      } else {
        parseCsvContent(content);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // Parser JSON Inteligente & Flexível
  function parseJsonContent(text) {
    try {
      const parsed = JSON.parse(text);
      let items = [];
      let defaultLeaderInJson = null;

      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && typeof parsed === 'object') {
        defaultLeaderInJson = parsed.lider || parsed.leader || parsed.responsavel || null;
        if (Array.isArray(parsed.contatos)) items = parsed.contatos;
        else if (Array.isArray(parsed.contacts)) items = parsed.contacts;
        else if (Array.isArray(parsed.data)) items = parsed.data;
        else if (Array.isArray(parsed.items)) items = parsed.items;
        else if (Array.isArray(parsed.base)) items = parsed.base;
        else {
          // Procura por qualquer chave que seja um array
          const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
          if (arrayKey) items = parsed[arrayKey];
          else {
            showToast('Estrutura JSON inválida. O arquivo deve conter uma lista de contatos.', 'error');
            return;
          }
        }
      }

      if (!items || items.length === 0) {
        showToast('Nenhum contato encontrado no arquivo JSON.', 'warning');
        return;
      }

      // Normaliza os contatos do JSON
      const normalizedContacts = [];
      items.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;

        const rawName = item.nome || item.name || item.contato || item.nome_completo || item.full_name || `Contato ${index + 1}`;
        const rawPhone = item.telefone || item.phone || item.whatsapp || item.tel || item.celular || item.wpp || item.numero || item.number || '';
        const rawCity = item.cidade || item.city || item.municipio || item.uf || '';
        const rawNeighborhood = item.bairro || item.neighborhood || item.distrito || item.regiao || '';
        const rawLeader = item.lider || item.leader || item.assigned_to_name || item.responsavel || item.operador || defaultLeaderInJson || '';

        const cleanPhone = sanitizePhoneNumber(rawPhone);

        normalizedContacts.push({
          rawName: String(rawName).trim(),
          rawPhone: String(rawPhone).trim(),
          cleanPhone,
          city: String(rawCity).trim(),
          neighborhood: String(rawNeighborhood).trim(),
          bairro: String(rawNeighborhood).trim(),
          leader: String(rawLeader).trim()
        });
      });

      const validCount = normalizedContacts.filter(c => c.cleanPhone).length;
      if (validCount === 0) {
        showToast('Nenhum telefone válido encontrado nos registros do JSON.', 'error');
        return;
      }

      renderStep2Json(normalizedContacts);
    } catch (err) {
      console.error('Erro ao analisar JSON:', err);
      showToast('Erro ao ler arquivo JSON: Formato inválido. ' + err.message, 'error');
    }
  }

  // Render Step 2 para Importação JSON
  function renderStep2Json(contactsList) {
    const validCount = contactsList.filter(c => c.cleanPhone).length;
    const invalidCount = contactsList.length - validCount;
    const sampleContacts = contactsList.slice(0, 5);

    container.innerHTML = `
      <div class="page-content" style="max-width: 1000px; margin: 0 auto; padding: 1.5rem;">
        
        <div style="margin-bottom: 1.75rem;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; margin: 0;">
            Revisão & Atribuição de Líder (JSON)
          </h2>
          <p style="font-size: 0.88rem; color: #64748B; margin-top: 0.25rem;">
            Passo 2 de 2: Defina para qual equipe ou líder esses contatos serão distribuídos.
          </p>
        </div>

        <div class="main-panel-card" style="padding: 1.75rem; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          
          <!-- Seletor de Equipe & Líder Destino -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; background: #F8FAFC; padding: 1.25rem; border-radius: 10px; border: 1px solid #CBD5E1; margin-bottom: 1.5rem;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">
                🏢 Equipe Destino
              </label>
              <select id="import-team-select" class="form-control" style="width: 100%; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.88rem; background: #FFFFFF;" ${!isAdmin ? 'disabled' : ''}>
                <option value="${currentUser.team_id || ''}">
                  ${currentUser.team_name || (currentUser.team_id ? 'Minha Equipe' : 'Selecione uma equipe')}
                </option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">
                👤 Atribuir / Distribuir Contatos Para:
              </label>
              <select id="import-member-select" class="form-control" style="width: 100%; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.88rem; background: #FFFFFF;">
                <option value="auto_match">🎯 Respeitar Líder indicado no JSON (Correspondência Automática)</option>
                <option value="distribute_equally">👥 Dividir Igualmente entre Membros da Equipe</option>
                <option value="${currentUser.uid}">⭐ ${currentUser.name} (Atribuir Todos para Mim)</option>
              </select>
            </div>
          </div>

          <!-- Cards de Resumo -->
          <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 180px; background: #F0FDF4; border: 1px solid #BBF7D0; padding: 0.85rem 1rem; border-radius: 8px;">
              <div style="font-size: 0.75rem; font-weight: 700; color: #15803D;">CONTATOS VÁLIDOS</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #166534;">${validCount}</div>
            </div>
            
            ${invalidCount > 0 ? `
              <div style="flex: 1; min-width: 180px; background: #FEF2F2; border: 1px solid #FECACA; padding: 0.85rem 1rem; border-radius: 8px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #B91C1C;">INVÁLIDOS (SEM NÚMERO)</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #991B1B;">${invalidCount}</div>
              </div>
            ` : ''}

            <div style="flex: 1; min-width: 180px; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 0.85rem 1rem; border-radius: 8px;">
              <div style="font-size: 0.75rem; font-weight: 700; color: #1D4ED8;">FORMATO DO ARQUIVO</div>
              <div style="font-size: 1.1rem; font-weight: 800; color: #1E40AF; margin-top: 4px;">{ } JSON Estruturado</div>
            </div>
          </div>

          <!-- Prévia da Tabela de Contatos -->
          <div style="margin-bottom: 1.5rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">
              👀 Prévia dos primeiros contatos identificados:
            </div>
            
            <div class="table-container" style="max-height: 260px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 8px;">
              <table class="panel-table" style="margin: 0; width: 100%;">
                <thead style="position: sticky; top: 0; background: #F8FAFC; z-index: 1;">
                  <tr>
                    <th>Nome</th>
                    <th>Telefone Formatado</th>
                    <th>Localização (Cidade / Bairro)</th>
                    <th>Líder no JSON</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${sampleContacts.map(c => `
                    <tr>
                      <td style="font-weight: 700; color: #0F172A;">${c.rawName}</td>
                      <td>
                        <span style="font-weight: 600; color: ${c.cleanPhone ? '#0F172A' : '#DC2626'};">
                          ${c.cleanPhone ? formatPhoneDisplay(c.cleanPhone) : (c.rawPhone || 'Inválido')}
                        </span>
                      </td>
                      <td style="color: #64748B;">${[c.city, c.neighborhood].filter(Boolean).join(' · ') || '—'}</td>
                      <td style="color: #4338CA; font-weight: 600;">${c.leader || '—'}</td>
                      <td>
                        ${c.cleanPhone 
                          ? `<span style="color: #15803D; font-weight: 700; font-size: 0.75rem;">✓ Pronto</span>` 
                          : `<span style="color: #DC2626; font-weight: 700; font-size: 0.75rem;">✕ Ignorado</span>`
                        }
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Barra de Progresso de Gravação -->
          <div id="import-progress-area" style="display: none; margin-bottom: 1.5rem; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #1D4ED8; margin-bottom: 0.5rem;">
              <span id="import-progress-label">Salvando contatos no banco de dados...</span>
              <span id="import-progress-percent">0%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #DBEAFE; border-radius: 9999px; overflow: hidden;">
              <div id="import-progress-bar" style="width: 0%; height: 100%; background: #2563EB; transition: width 0.2s;"></div>
            </div>
          </div>

          <!-- Ações Finais -->
          <div style="display: flex; justify-content: flex-end; gap: 0.85rem; align-items: center; border-top: 1px solid #E2E8F0; padding-top: 1.25rem;">
            <button id="btn-import-back" class="btn-outline-white" style="padding: 0.65rem 1.25rem; font-weight: 600; cursor: pointer;">
              Voltar
            </button>
            <button id="btn-finish-import-json" class="btn-green-action" style="padding: 0.65rem 1.5rem; font-size: 0.9rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Importar ${validCount} Contatos</span>
            </button>
          </div>

        </div>
      </div>
    `;

    // Carrega membros da equipe para o dropdown
    subscribeToTeamMembers(currentUser?.team_id, isCoordinator ? currentUser.uid : null, (members) => {
      teamMembers = members;
      const memSel = container.querySelector('#import-member-select');
      if (memSel) {
        memSel.innerHTML = `
          <option value="auto_match">🎯 Respeitar Líder indicado no JSON (Correspondência Automática)</option>
          <option value="distribute_equally">👥 Dividir Igualmente entre Membros (${members.length} membros)</option>
          <option value="${currentUser.uid}">⭐ ${currentUser.name} (Atribuir Todos para Mim)</option>
          ${members.map(m => `<option value="${m.uid}">👤 ${m.name || m.email} (Atribuir Todos)</option>`).join('')}
        `;
      }
    });

    if (isAdmin) {
      subscribeToTenantTeams('tenant_main', (teams) => {
        availableTeams = teams;
        const teamSel = container.querySelector('#import-team-select');
        if (teamSel && teams.length > 0) {
          teamSel.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
      });
    }

    container.querySelector('#btn-import-back')?.addEventListener('click', () => renderStep1());

    container.querySelector('#btn-finish-import-json')?.addEventListener('click', async () => {
      const finishBtn = container.querySelector('#btn-finish-import-json');
      const progressArea = container.querySelector('#import-progress-area');
      const progressBar = container.querySelector('#import-progress-bar');
      const progressPercent = container.querySelector('#import-progress-percent');

      const selectedAssignee = container.querySelector('#import-member-select').value;
      const targetTeamId = container.querySelector('#import-team-select').value;

      finishBtn.disabled = true;
      progressArea.style.display = 'block';

      const validMembers = teamMembers.length > 0 ? teamMembers : [{ uid: currentUser.uid, name: currentUser.name }];
      const validContacts = contactsList.filter(c => c.cleanPhone);

      const contactsToSave = [];

      validContacts.forEach((c) => {
        let assignedUid = selectedAssignee;
        let assignedName = currentUser.name;

        if (selectedAssignee === 'auto_match') {
          // Tenta casar o nome do líder presente no JSON com os membros cadastrados
          if (c.leader) {
            const leaderLower = c.leader.toLowerCase();
            const matchedMember = teamMembers.find(m => 
              (m.name && m.name.toLowerCase().includes(leaderLower)) ||
              (m.email && m.email.toLowerCase().includes(leaderLower)) ||
              leaderLower.includes(m.name?.toLowerCase() || '')
            );

            if (matchedMember) {
              assignedUid = matchedMember.uid;
              assignedName = matchedMember.name || matchedMember.email;
            } else {
              // Se não encontrou o líder pelo nome, divide entre os membros
              const memberIndex = contactsToSave.length % validMembers.length;
              assignedUid = validMembers[memberIndex].uid;
              assignedName = validMembers[memberIndex].name;
            }
          } else {
            const memberIndex = contactsToSave.length % validMembers.length;
            assignedUid = validMembers[memberIndex].uid;
            assignedName = validMembers[memberIndex].name;
          }
        } else if (selectedAssignee === 'distribute_equally') {
          const memberIndex = contactsToSave.length % validMembers.length;
          assignedUid = validMembers[memberIndex].uid;
          assignedName = validMembers[memberIndex].name;
        } else if (selectedAssignee === currentUser.uid) {
          assignedUid = currentUser.uid;
          assignedName = currentUser.name || 'Eu';
        } else {
          const targetMember = teamMembers.find(m => m.uid === selectedAssignee);
          if (targetMember) {
            assignedName = targetMember.name || targetMember.email;
          }
        }

        contactsToSave.push({
          name: c.rawName || 'Contato',
          phone: c.cleanPhone,
          city: c.city || '',
          neighborhood: c.neighborhood || c.bairro || '',
          bairro: c.neighborhood || c.bairro || '',
          tenant_id: currentUser.tenant_id || 'tenant_main',
          team_id: targetTeamId || null,
          assigned_to: assignedUid,
          assigned_to_name: assignedName,
          status: 'pending'
        });
      });

      try {
        await saveContactsBatch(contactsToSave, (saved, total) => {
          const pct = Math.round((saved / total) * 100);
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}% (${saved}/${total})`;
        });

        showToast(`🎉 ${contactsToSave.length} contatos importados com sucesso!`, 'success');
        setTimeout(() => onNavigate('contacts'), 800);
      } catch (err) {
        console.error('Erro ao salvar contatos no Firestore:', err);
        showToast(`Erro ao gravar no Firestore: ${err.message || 'Falha de conexão'}`, 'error');
        finishBtn.disabled = false;
      }
    });
  }

  // Parser CSV (Compatibilidade Retroativa)
  function parseCsvContent(text) {
    if (!text || text.trim().length === 0) {
      showToast('O arquivo CSV está vazio.', 'error');
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
      showToast('O arquivo CSV precisa ter ao menos o cabeçalho e 1 linha de contato.', 'warning');
      return;
    }

    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));

    const parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.some(val => val.length > 0)) {
        parsedRows.push(cols);
      }
    }

    if (parsedRows.length === 0) {
      showToast('Nenhum dado válido encontrado no arquivo CSV.', 'error');
      return;
    }

    renderStep2Csv(headers, parsedRows);
  }

  function renderStep2Csv(headers, rows) {
    const sampleRow = rows[0] || [];

    container.innerHTML = `
      <div class="page-content" style="max-width: 1000px; margin: 0 auto; padding: 1.5rem;">
        <div style="margin-bottom: 1.75rem;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; margin: 0;">
            Mapeamento de Colunas (CSV)
          </h2>
          <p style="font-size: 0.88rem; color: #64748B; margin-top: 0.25rem;">
            Passo 2 de 2: Mapeie as colunas da planilha e defina a distribuição.
          </p>
        </div>

        <div class="main-panel-card" style="padding: 1.75rem; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          <!-- Team & Assignee Selection -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; background: #F8FAFC; padding: 1.25rem; border-radius: 10px; border: 1px solid #CBD5E1; margin-bottom: 1.5rem;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">Equipe Destino</label>
              <select id="import-team-select" class="form-control" style="width: 100%; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.88rem; background: #FFFFFF;" ${!isAdmin ? 'disabled' : ''}>
                <option value="${currentUser.team_id || ''}">
                  ${currentUser.team_name || (currentUser.team_id ? 'Minha Equipe' : 'Selecione uma equipe')}
                </option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">Distribuir Contatos Para:</label>
              <select id="import-member-select" class="form-control" style="width: 100%; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.88rem; background: #FFFFFF;">
                <option value="distribute_equally">Dividir Igualmente entre Membros da Equipe</option>
                <option value="${currentUser.uid}">${currentUser.name} (Atribuir Todos para Mim)</option>
              </select>
            </div>
          </div>

          <div class="table-container" style="margin-bottom: 1.5rem;">
            <table class="panel-table">
              <thead>
                <tr>
                  <th style="width: 32%;">COLUNA NO ARQUIVO (CSV)</th>
                  <th style="width: 38%;">CAMPO NO SISTEMA</th>
                  <th style="width: 30%;">EXEMPLO DE DADO (LINHA 1)</th>
                </tr>
              </thead>
              <tbody id="mapping-tbody">
                ${headers.map((h, idx) => {
                  const val = sampleRow[idx] || '—';
                  const lower = h.toLowerCase();
                  const isName = lower.includes('nome') || lower.includes('name') || idx === 0;
                  const isPhone = lower.includes('tel') || lower.includes('cel') || lower.includes('phone') || idx === 1;
                  const isNeighborhood = lower.includes('bairro') || lower.includes('neighborhood') || lower.includes('distrito');
                  const isCity = !isNeighborhood && (lower.includes('cidade') || lower.includes('city') || lower.includes('municipio') || lower.includes('uf') || lower.includes('regiao'));

                  return `
                    <tr>
                      <td style="font-weight: 700; color: #0F172A;">${h}</td>
                      <td>
                        <select class="topbar-search-input col-map-select" data-col-index="${idx}" style="width: 220px; background: #FFFFFF; border-radius: 8px; padding: 0.45rem 0.75rem; border: 1px solid #CBD5E1;">
                          <option value="name" ${isName ? 'selected' : ''}>Nome do Contato</option>
                          <option value="phone" ${isPhone ? 'selected' : ''}>Telefone / WhatsApp (Obrigatório)</option>
                          <option value="city" ${isCity ? 'selected' : ''}>Cidade</option>
                          <option value="neighborhood" ${isNeighborhood ? 'selected' : ''}>Bairro</option>
                          <option value="ignore" ${!isName && !isPhone && !isCity && !isNeighborhood ? 'selected' : ''}>Ignorar coluna</option>
                        </select>
                      </td>
                      <td style="color: #4B5563; font-style: italic;">${val}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div id="import-progress-area" style="display: none; margin-bottom: 1.5rem; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #1D4ED8; margin-bottom: 0.5rem;">
              <span id="import-progress-label">Salvando no Firestore...</span>
              <span id="import-progress-percent">0%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #DBEAFE; border-radius: 9999px; overflow: hidden;">
              <div id="import-progress-bar" style="width: 0%; height: 100%; background: #2563EB; transition: width 0.2s;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.85rem; align-items: center; border-top: 1px solid #E2E8F0; padding-top: 1.25rem;">
            <button id="btn-import-back" class="btn-outline-white" style="padding: 0.65rem 1.25rem; font-weight: 600; cursor: pointer;">Voltar</button>
            <button id="btn-finish-import" class="btn-green-action" style="padding: 0.65rem 1.5rem; font-size: 0.9rem; font-weight: 700; cursor: pointer;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Finalizar Importação
            </button>
          </div>
        </div>
      </div>
    `;

    subscribeToTeamMembers(currentUser?.team_id, isCoordinator ? currentUser.uid : null, (members) => {
      teamMembers = members;
      const memSel = container.querySelector('#import-member-select');
      if (memSel) {
        memSel.innerHTML = `
          <option value="distribute_equally">Dividir Igualmente entre Membros (${members.length} membros)</option>
          <option value="${currentUser.uid}">${currentUser.name} (Atribuir para Mim)</option>
          ${members.map(m => `<option value="${m.uid}">${m.name} (${m.email})</option>`).join('')}
        `;
      }
    });

    if (isAdmin) {
      subscribeToTenantTeams('tenant_main', (teams) => {
        availableTeams = teams;
        const teamSel = container.querySelector('#import-team-select');
        if (teamSel && teams.length > 0) {
          teamSel.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
      });
    }

    container.querySelector('#btn-import-back')?.addEventListener('click', () => renderStep1());

    container.querySelector('#btn-finish-import')?.addEventListener('click', async () => {
      const finishBtn = container.querySelector('#btn-finish-import');
      const progressArea = container.querySelector('#import-progress-area');
      const progressBar = container.querySelector('#import-progress-bar');
      const progressPercent = container.querySelector('#import-progress-percent');

      const selects = container.querySelectorAll('.col-map-select');
      const map = {};
      selects.forEach(s => {
        const colIdx = parseInt(s.getAttribute('data-col-index'), 10);
        map[s.value] = colIdx;
      });

      if (map.phone === undefined) {
        showToast('Você deve mapear qual coluna contém o Telefone/WhatsApp.', 'warning');
        return;
      }

      const selectedAssignee = container.querySelector('#import-member-select').value;
      const targetTeamId = container.querySelector('#import-team-select').value;

      finishBtn.disabled = true;
      progressArea.style.display = 'block';

      const validMembers = teamMembers.length > 0 ? teamMembers : [{ uid: currentUser.uid, name: currentUser.name }];

      const contactsToSave = [];

      rows.forEach((r) => {
        const rawPhone = map.phone !== undefined ? r[map.phone] : '';
        const cleanPhone = sanitizePhoneNumber(rawPhone);

        if (!cleanPhone) return;

        let assignedUid = selectedAssignee;
        let assignedName = currentUser.name;

        if (selectedAssignee === 'distribute_equally') {
          const memberIndex = contactsToSave.length % validMembers.length;
          assignedUid = validMembers[memberIndex].uid;
          assignedName = validMembers[memberIndex].name;
        } else if (selectedAssignee === currentUser.uid) {
          assignedUid = currentUser.uid;
          assignedName = currentUser.name || currentUser.email || 'Eu';
        } else {
          const targetMember = teamMembers.find(m => m.uid === selectedAssignee);
          if (targetMember) {
            assignedName = targetMember.name || targetMember.email;
          }
        }

        contactsToSave.push({
          name: map.name !== undefined ? (r[map.name] || 'Contato') : 'Contato',
          phone: cleanPhone,
          city: map.city !== undefined ? (r[map.city] || '') : '',
          neighborhood: map.neighborhood !== undefined ? (r[map.neighborhood] || '') : '',
          bairro: map.neighborhood !== undefined ? (r[map.neighborhood] || '') : '',
          tenant_id: currentUser.tenant_id || 'tenant_main',
          team_id: targetTeamId || null,
          assigned_to: assignedUid,
          assigned_to_name: assignedName,
          status: 'pending'
        });
      });

      if (contactsToSave.length === 0) {
        showToast('Nenhum número de telefone válido encontrado no CSV.', 'error');
        finishBtn.disabled = false;
        progressArea.style.display = 'none';
        return;
      }

      try {
        await saveContactsBatch(contactsToSave, (saved, total) => {
          const pct = Math.round((saved / total) * 100);
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}% (${saved}/${total})`;
        });

        showToast(`${contactsToSave.length} contatos importados com sucesso!`, 'success');
        setTimeout(() => onNavigate('contacts'), 800);
      } catch (err) {
        console.error('Erro ao importar contatos:', err);
        showToast(`Erro ao gravar no Firestore: ${err.message || 'Falha de conexão'}`, 'error');
        finishBtn.disabled = false;
      }
    });
  }

  renderStep1();
  return () => {};
}

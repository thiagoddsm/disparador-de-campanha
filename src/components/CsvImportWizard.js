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

export function renderCsvImportWizard(container, currentUser, onNavigate) {
  let parsedRows = [];
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

  function renderStep1() {
    container.innerHTML = `
      <div class="page-content">
        <div style="margin-bottom: 1.75rem;">
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">Importar Contatos</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">Passo 1 de 2: Selecione sua planilha de contatos (.CSV)</p>
        </div>

        <div class="main-panel-card" style="padding: 2.5rem 1.5rem; text-align: center;">
          <div style="border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 3rem 1.5rem; background: #F8FAFC; max-width: 600px; margin: 0 auto; cursor: pointer;" id="drop-zone">
            <div style="width: 54px; height: 54px; border-radius: var(--radius-full); background: #EFF6FF; color: #1D4ED8; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Selecione sua planilha .CSV</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.4rem 0 1.25rem 0;">ou arraste e solte o arquivo aqui</p>
            <input type="file" id="csv-file-input" accept=".csv,.txt" style="display: none;">
            <button type="button" id="btn-browse-file" class="btn-primary-blue" style="margin: 0 auto;">Escolher Arquivo do Computador</button>
          </div>

          <div style="margin-top: 2rem; display: flex; justify-content: center; gap: 1.5rem; font-size: 0.8rem; color: var(--text-muted);">
            <span>✓ Formatos suportados: UTF-8, Separador por vírgula (,) ou ponto-e-vírgula (;)</span>
          </div>
        </div>
      </div>
    `;

    const fileInput = container.querySelector('#csv-file-input');
    const browseBtn = container.querySelector('#btn-browse-file');
    const dropZone = container.querySelector('#drop-zone');

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
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-color)';
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseCsvContent(content);
    };
    reader.readAsText(file);
  }

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

    parsedRows = [];
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

    renderStep2(headers, parsedRows);
  }

  function renderStep2(headers, rows) {
    const sampleRow = rows[0] || [];

    container.innerHTML = `
      <div class="page-content">
        <div style="margin-bottom: 1.75rem;">
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.4px;">Importar Contatos</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">Passo 2 de 2: Mapeamento de Colunas e Distribuição para a Equipe</p>
        </div>

        <div class="main-panel-card" style="padding: 1.5rem;">
          <!-- Team & Assignee Selection -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Equipe Destino</label>
              <select id="import-team-select" class="form-control" ${!isAdmin ? 'disabled' : ''}>
                <option value="${currentUser.team_id || ''}">
                  ${currentUser.team_name || (currentUser.team_id ? 'Minha Equipe' : 'Selecione uma equipe')}
                </option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">Distribuir Contatos Para:</label>
              <select id="import-member-select" class="form-control">
                <option value="distribute_equally">Dividir Igualmente entre Membros da Equipe</option>
                <option value="${currentUser.uid}">${currentUser.name} (Atribuir para Mim)</option>
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
                      <td style="font-weight: 600; color: var(--text-main);">${h}</td>
                      <td>
                        <select class="topbar-search-input col-map-select" data-col-index="${idx}" style="width: 220px; background: #FFFFFF; border-radius: var(--radius-md); padding: 0.45rem 0.75rem;">
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

          <div id="import-progress-area" style="display: none; margin-bottom: 1.5rem; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #1D4ED8; margin-bottom: 0.5rem;">
              <span id="import-progress-label">Salvando no Firestore...</span>
              <span id="import-progress-percent">0%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #DBEAFE; border-radius: 9999px; overflow: hidden;">
              <div id="import-progress-bar" style="width: 0%; height: 100%; background: #2563EB; transition: width 0.2s;"></div>
            </div>
          </div>

          <div class="note-box-blue" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: bold; font-size: 1rem;">ⓘ</span>
            <span>${headers.length} colunas identificadas. <strong>${rows.length} contatos</strong> prontos para distribuição.</span>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.85rem; align-items: center;">
            <button id="btn-import-back" class="btn-outline-white" style="padding: 0.6rem 1.25rem;">Voltar</button>
            <button id="btn-finish-import" class="btn-green-action" style="padding: 0.6rem 1.25rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Finalizar Importação
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
      let skippedCount = 0;

      rows.forEach((r, idx) => {
        const rawPhone = map.phone !== undefined ? r[map.phone] : '';
        const cleanPhone = sanitizePhoneNumber(rawPhone);

        if (!cleanPhone) {
          skippedCount++;
          return;
        }

        let assignedUid = selectedAssignee;
        let assignedName = currentUser.name;

        if (selectedAssignee === 'distribute_equally') {
          const memberIndex = contactsToSave.length % validMembers.length;
          assignedUid = validMembers[memberIndex].uid;
          assignedName = validMembers[memberIndex].name;
        } else if (selectedAssignee === 'self' || selectedAssignee === currentUser.uid) {
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


import { importContactsBatchToFirestore, subscribeToTenantTeams, subscribeToTeamMembers } from '../firebase/realtime.js';

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
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseCsvContent(content);
    };
    reader.readAsText(file);
  }

  function parseCsvContent(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      alert('O arquivo CSV precisa ter ao menos o cabeçalho e 1 linha de dados.');
      return;
    }

    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));

    parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 2) {
        parsedRows.push(cols);
      }
    }

    renderStep2(headers, parsedRows);
  }

  function renderStep2(headers = ['Nome do Cliente', 'Celular', 'Email Contato', 'Empresa Atual'], rows = []) {
    const sampleRow = rows.length > 0 ? rows[0] : ['João Silva Santos', '(11) 98765-4321', 'joao.silva@exemplo.com', 'Acme Corp LTDA'];

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
                <option value="${currentUser.team_id || 'team_alpha'}">
                  ${currentUser.team_id || 'Equipe Alpha'}
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
                  const isComp = lower.includes('empresa') || lower.includes('company') || lower.includes('bairro') || idx === 3;

                  return `
                    <tr>
                      <td style="font-weight: 600; color: var(--text-main);">${h}</td>
                      <td>
                        <select class="topbar-search-input col-map-select" data-col-index="${idx}" style="width: 220px; background: #FFFFFF; border-radius: var(--radius-md); padding: 0.45rem 0.75rem;">
                          <option value="name" ${isName ? 'selected' : ''}>Nome</option>
                          <option value="phone" ${isPhone ? 'selected' : ''}>Telefone</option>
                          <option value="company" ${isComp ? 'selected' : ''}>Empresa / Região</option>
                          <option value="ignore" ${!isName && !isPhone && !isComp ? 'selected' : ''}>Ignorar coluna</option>
                        </select>
                      </td>
                      <td style="color: #4B5563; font-style: italic;">${val}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="note-box-blue" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: bold; font-size: 1rem;">ⓘ</span>
            <span>${headers.length} colunas identificadas. ${rows.length > 0 ? `${rows.length} contatos prontos para distribuição.` : 'Pronto para processar.'}</span>
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
          <option value="distribute_equally">Dividir Igualmente entre Membros (${members.length} operadores)</option>
          <option value="${currentUser.uid}">${currentUser.name} (Atribuir para Mim)</option>
          ${members.map(m => `<option value="${m.uid}">${m.name} (${m.email})</option>`).join('')}
        `;
      }
    });

    container.querySelector('#btn-import-back')?.addEventListener('click', () => renderStep1());

    container.querySelector('#btn-finish-import')?.addEventListener('click', async () => {
      const finishBtn = container.querySelector('#btn-finish-import');
      finishBtn.disabled = true;
      finishBtn.innerHTML = 'Processando lote no Firestore...';

      const selects = container.querySelectorAll('.col-map-select');
      const map = {};
      selects.forEach(s => {
        const colIdx = parseInt(s.getAttribute('data-col-index'), 10);
        map[s.value] = colIdx;
      });

      const selectedAssignee = container.querySelector('#import-member-select').value;
      const targetTeamId = container.querySelector('#import-team-select').value;

      let contactsToSave = [];
      const rawData = rows.length > 0 ? rows : [
        ['João Silva Santos', '(11) 98765-4321', 'joao.silva@exemplo.com', 'Acme Corp LTDA'],
        ['Mariana Lima', '(21) 99876-5432', 'mariana@exemplo.com', 'Tech Soluções'],
        ['Carlos Eduardo', '(31) 97654-3210', 'carlos@exemplo.com', 'Comércio Central']
      ];

      const validMembers = teamMembers.length > 0 ? teamMembers : [{ uid: currentUser.uid, name: currentUser.name }];

      contactsToSave = rawData.map((r, idx) => {
        let assignedUid = selectedAssignee;
        let assignedName = currentUser.name;

        if (selectedAssignee === 'distribute_equally') {
          const memberIndex = idx % validMembers.length;
          assignedUid = validMembers[memberIndex].uid;
          assignedName = validMembers[memberIndex].name;
        }

        return {
          name: map.name !== undefined ? (r[map.name] || 'Contato') : 'Contato',
          phone: map.phone !== undefined ? (r[map.phone] || '') : '',
          company: map.company !== undefined ? (r[map.company] || '') : '',
          tenant_id: currentUser.tenant_id || 'tenant_main',
          team_id: targetTeamId,
          assigned_to: assignedUid,
          assigned_to_name: assignedName
        };
      }).filter(c => c.phone);

      try {
        await importContactsBatchToFirestore(contactsToSave);
        alert(`🎉 Sucesso! ${contactsToSave.length} contatos foram importados e distribuídos com sucesso!`);
        onNavigate('contacts');
      } catch (err) {
        alert('Erro ao importar contatos.');
      } finally {
        finishBtn.disabled = false;
        finishBtn.innerHTML = 'Finalizar Importação';
      }
    });
  }

  renderStep1();
  return () => {};
}

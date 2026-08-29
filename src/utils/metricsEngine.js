/**
 * DispatchPro - Motor Unificado de Métricas da Rede de Mobilização
 * Fonte única de verdade para cálculos de cobertura, rankings e alertas gerenciais.
 */

/**
 * Normaliza strings para comparações case-insensitive e trim.
 */
function cleanStr(val) {
  if (!val) return '';
  return String(val).trim().toLowerCase();
}

/**
 * Verifica se um contato é considerado "Abordado" na rede.
 * Considera os status de envio ou existência de registro no histórico de mensagens.
 */
export function isContactAbordado(contact, messagesByContactId = new Set()) {
  if (!contact) return false;
  if (['opened', 'user_confirmed', 'confirmed'].includes(contact.status)) {
    return true;
  }
  if (contact.id && messagesByContactId.has(contact.id)) {
    return true;
  }
  return false;
}

/**
 * Calcula a Cobertura Geral da Rede ou de uma Equipe/Líder.
 * @param {Array} contacts - Lista de contatos
 * @param {Array} messages - Lista de mensagens disparadas
 * @returns {Object} { total, abordados, pendentes, rate, rateFormatted }
 */
export function calculateNetworkCoverage(contacts = [], messages = []) {
  const total = contacts.length;
  const messagesContactIds = new Set(messages.map(m => m.contact_id).filter(Boolean));

  let abordados = 0;
  contacts.forEach(c => {
    if (isContactAbordado(c, messagesContactIds)) {
      abordados++;
    }
  });

  // Se houver mensagens avulsas no histórico que superem a contagem
  const totalEfettivoAbordados = Math.min(total, Math.max(abordados, messages.length));
  const pendentes = Math.max(0, total - totalEfettivoAbordados);
  const rate = total > 0 ? Math.round((totalEfettivoAbordados / total) * 100) : 0;

  return {
    total,
    abordados: totalEfettivoAbordados,
    pendentes,
    rate,
    rateFormatted: `${rate}%`
  };
}

/**
 * Consolida o Ranking e Performance Comparativa de Coordenadores / Equipes.
 * @param {Array} teams - Lista de equipes
 * @param {Array} users - Lista de todos os usuários
 * @param {Array} contacts - Lista de todos os contatos
 * @param {Array} messages - Lista de mensagens do histórico
 * @returns {Array} Lista ordenada por taxa de cobertura decrescente
 */
export function calculateCoordinatorsRanking(teams = [], users = [], contacts = [], messages = []) {
  return teams.map(team => {
    const teamUsers = users.filter(u => u.team_id === team.id || u.team_name === team.name);
    const teamUserUids = new Set(teamUsers.map(u => u.uid));
    const teamUserEmails = new Set(teamUsers.map(u => cleanStr(u.email)).filter(Boolean));
    const teamUserNames = new Set(teamUsers.map(u => cleanStr(u.name)).filter(Boolean));

    // Contatos pertencentes a esta equipe
    const teamContacts = contacts.filter(c => 
      c.team_id === team.id ||
      c.team_id === team.name ||
      c.team_name === team.name ||
      teamUserUids.has(c.assigned_to) ||
      (c.assigned_to && teamUserEmails.has(cleanStr(c.assigned_to))) ||
      (c.assigned_to_name && teamUserNames.has(cleanStr(c.assigned_to_name)))
    );

    // Mensagens disparadas pela equipe
    const teamMessages = messages.filter(m => 
      m.team_id === team.id ||
      m.team_id === team.name ||
      m.team_name === team.name ||
      teamUserUids.has(m.user_uid) ||
      (m.user_email && teamUserEmails.has(cleanStr(m.user_email)))
    );

    const coverage = calculateNetworkCoverage(teamContacts, teamMessages);
    const coordinator = users.find(u => u.uid === team.coordinator_uid || (u.role === 'coordinator' && u.team_id === team.id));

    return {
      teamId: team.id,
      teamName: team.name,
      coordinatorUid: coordinator?.uid || team.coordinator_uid || null,
      coordinatorName: coordinator?.name || team.coordinator_name || 'Coordenador Não Vinculado',
      coordinatorEmail: coordinator?.email || null,
      totalLeaders: teamUsers.filter(u => u.role === 'member' || !u.role).length,
      totalContacts: coverage.total,
      abordados: coverage.abordados,
      pendentes: coverage.pendentes,
      rate: coverage.rate,
      rateFormatted: coverage.rateFormatted,
      teamUsers,
      teamContacts
    };
  }).sort((a, b) => b.rate - a.rate || b.abordados - a.abordados);
}

/**
 * Consolida o Desempenho e Metas Individuais de Líderes.
 * @param {Array} leaders - Lista de membros/líderes
 * @param {Array} contacts - Lista de contatos
 * @param {Array} messages - Lista de mensagens
 * @returns {Array} Lista ordenada por abordagens e taxa de conclusão decrescente
 */
export function calculateLeadersPerformance(leaders = [], contacts = [], messages = []) {
  return leaders.map(leader => {
    const leaderUid = leader.uid;
    const leaderEmail = cleanStr(leader.email);
    const leaderName = cleanStr(leader.name);

    // Contatos vinculados a este líder
    const memberContacts = contacts.filter(c => 
      c.assigned_to === leaderUid ||
      (leaderEmail && cleanStr(c.assigned_to) === leaderEmail) ||
      (leaderName && cleanStr(c.assigned_to_name) === leaderName)
    );

    // Mensagens no histórico disparadas por este líder
    const memberMessages = messages.filter(m => 
      m.user_uid === leaderUid ||
      (leaderEmail && cleanStr(m.user_email) === leaderEmail) ||
      (leaderName && cleanStr(m.user_name) === leaderName)
    );

    const coverage = calculateNetworkCoverage(memberContacts, memberMessages);
    
    // Meta individual: carteira atribuída ou meta configurada (mínimo 30)
    const goal = leader.daily_goal || (memberContacts.length > 0 ? memberContacts.length : 30);
    const pct = goal > 0 ? Math.min(100, Math.round((coverage.abordados / goal) * 100)) : 0;

    // Status da Instância WhatsApp
    const isConnected = leader.whatsapp?.status === 'CONNECTED' || leader.whatsapp_connected === true;
    const instanceName = leader.whatsapp?.instanceName || leader.whatsapp_instance || null;
    const phone = leader.whatsapp?.phoneNumber || leader.whatsapp_phone || null;

    // Última atividade registrada
    let lastActiveIso = leader.last_active_at || null;
    if (memberMessages.length > 0 && memberMessages[0].created_at) {
      const msgTime = memberMessages[0].created_at?.toDate ? memberMessages[0].created_at.toDate().toISOString() : memberMessages[0].created_at;
      if (!lastActiveIso || new Date(msgTime) > new Date(lastActiveIso)) {
        lastActiveIso = msgTime;
      }
    }

    return {
      uid: leader.uid,
      name: leader.name || leader.email?.split('@')[0] || 'Líder',
      email: leader.email,
      role: leader.role || 'member',
      team_id: leader.team_id || null,
      team_name: leader.team_name || null,
      is_active: leader.is_active !== false,
      memberContacts,
      memberMessages,
      totalContacts: memberContacts.length,
      abordados: coverage.abordados,
      pendentes: Math.max(0, memberContacts.length - coverage.abordados),
      goal,
      pct,
      pctFormatted: `${pct}%`,
      isConnected,
      instanceName,
      phone,
      lastActiveIso
    };
  }).sort((a, b) => b.abordados - a.abordados || b.pct - a.pct);
}

/**
 * Gera Alertas Inteligentes de Gestão da Rede.
 * @param {Array} leadersPerformance - Resultado de calculateLeadersPerformance
 * @param {Object} coverage - Resultado de calculateNetworkCoverage
 * @returns {Array} Lista de alertas com categoria, mensagem, severidade e contagem
 */
export function generateManagementAlerts(leadersPerformance = [], coverage = { pendentes: 0 }) {
  const alerts = [];

  const semAtividade = leadersPerformance.filter(l => l.is_active && l.abordados === 0);
  if (semAtividade.length > 0) {
    alerts.push({
      id: 'alert_no_activity',
      type: 'danger',
      severity: 'high',
      icon: '⚠️',
      title: 'Líderes sem nenhuma abordagem',
      message: `${semAtividade.length} líder(es) ainda não realizaram nenhum envio na campanha.`,
      count: semAtividade.length,
      items: semAtividade
    });
  }

  const atrasados = leadersPerformance.filter(l => l.is_active && l.totalContacts > 0 && l.pct < 30 && l.abordados > 0);
  if (atrasados.length > 0) {
    alerts.push({
      id: 'alert_lagging',
      type: 'warning',
      severity: 'medium',
      icon: '🟠',
      title: 'Líderes com ritmo atrasado',
      message: `${atrasados.length} líder(es) estão abaixo de 30% da meta da carteira.`,
      count: atrasados.length,
      items: atrasados
    });
  }

  const semWhatsapp = leadersPerformance.filter(l => l.is_active && !l.isConnected);
  if (semWhatsapp.length > 0) {
    alerts.push({
      id: 'alert_no_whatsapp',
      type: 'warning',
      severity: 'medium',
      icon: '📱',
      title: 'Instâncias WhatsApp desconectadas',
      message: `${semWhatsapp.length} líder(es) estão sem conexão ativa de WhatsApp para disparo.`,
      count: semWhatsapp.length,
      items: semWhatsapp
    });
  }

  if (coverage.pendentes > 0) {
    alerts.push({
      id: 'alert_pending_contacts',
      type: 'info',
      severity: 'low',
      icon: '⏳',
      title: 'Contatos aguardando primeira abordagem',
      message: `${coverage.pendentes} contatos ainda não foram abordados na rede.`,
      count: coverage.pendentes
    });
  }

  const concluidos = leadersPerformance.filter(l => l.is_active && l.totalContacts > 0 && l.pct >= 100);
  if (concluidos.length > 0) {
    alerts.push({
      id: 'alert_completed',
      type: 'success',
      severity: 'low',
      icon: '🟢',
      title: 'Metas 100% concluídas',
      message: `${concluidos.length} líder(es) já abordaram todos os seus contatos atribuídos!`,
      count: concluidos.length,
      items: concluidos
    });
  }

  return alerts;
}

/**
 * Agrupa as mensagens do histórico por dia e hora para alimentar gráficos temporais.
 * @param {Array} messages - Lista de mensagens
 * @param {Number} days - Quantidade de dias retroativos
 * @returns {Object} { byDay, byHour, todayCount, weekCount }
 */
export function calculateTimelineEvolution(messages = [], days = 7) {
  const now = new Date();
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const byDayMap = {};
  const byHourMap = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, count: 0 }));

  // Inicializa os últimos N dias
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = `${dayNames[d.getDay()]} (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')})`;
    byDayMap[key] = { key, label, count: 0 };
  }

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let todayCount = 0;
  let weekCount = 0;

  messages.forEach(msg => {
    let dateObj = null;
    if (msg.created_at?.toDate) dateObj = msg.created_at.toDate();
    else if (msg.sent_at?.toDate) dateObj = msg.sent_at.toDate();
    else if (msg.created_at) dateObj = new Date(msg.created_at);

    if (dateObj && !isNaN(dateObj.getTime())) {
      const msgKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      if (byDayMap[msgKey]) {
        byDayMap[msgKey].count++;
        weekCount++;
      }
      if (msgKey === todayKey) {
        todayCount++;
      }
      const hour = dateObj.getHours();
      if (byHourMap[hour]) {
        byHourMap[hour].count++;
      }
    }
  });

  return {
    byDay: Object.values(byDayMap),
    byHour: byHourMap,
    todayCount,
    weekCount,
    totalCount: messages.length
  };
}

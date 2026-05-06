/* =========================================
   KATAKATLA — LEADERBOARD
   Phase 4C + dynamic played/solved
========================================= */

const tabsEl = document.querySelectorAll('.lb-tab');
const infoEl = document.getElementById('lb-info');
const loadingEl = document.getElementById('lb-loading');
const tableEl = document.getElementById('lb-table');
const tbodyEl = document.getElementById('lb-tbody');
const emptyEl = document.getElementById('lb-empty');

let currentPeriod = 'daily';
let currentUserId = null;

const PERIOD_FN = {
  daily: 'get_leaderboard_daily',
  weekly: 'get_leaderboard_weekly',
  monthly: 'get_leaderboard_monthly',
};

const PERIOD_LABEL = {
  daily: 'hari ini',
  weekly: 'minggu ini',
  monthly: 'bulan ini',
};

function setActiveTab(period) {
  tabsEl.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.period === period);
  });
  currentPeriod = period;
  loadLeaderboard(period);
}

tabsEl.forEach(tab => {
  tab.addEventListener('click', () => setActiveTab(tab.dataset.period));
});

function showLoading() {
  loadingEl.classList.remove('hidden');
  tableEl.classList.add('hidden');
  emptyEl.classList.add('hidden');
}

function showEmpty() {
  loadingEl.classList.add('hidden');
  tableEl.classList.add('hidden');
  emptyEl.classList.remove('hidden');
}

function showTable() {
  loadingEl.classList.add('hidden');
  tableEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
}

function renderRows(rows) {
  tbodyEl.innerHTML = '';
  
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.user_id === currentUserId) {
      tr.classList.add('is-me');
    }
    
    const streakBadge = row.streak > 0 
      ? `<span class="streak-inline">🔥${row.streak}</span>` 
      : '';
    
    tr.innerHTML = `
      <td class="col-rank">${row.rank}</td>
      <td class="col-name">${escapeHtml(row.username)} ${streakBadge}</td>
      <td class="col-solved">${row.solved}/${row.played}</td>
      <td class="col-score">${row.total_score}</td>
    `;
    tbodyEl.appendChild(tr);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadLeaderboard(period) {
  showLoading();
  infoEl.textContent = `peringkat ${PERIOD_LABEL[period]} · top 50`;
  
  const fnName = PERIOD_FN[period];
  
  try {
    const { data, error } = await supabaseClient.rpc(fnName);
    
    if (error) {
      console.error(`❌ Gagal fetch ${period}:`, error.message);
      infoEl.textContent = `error: ${error.message}`;
      showEmpty();
      return;
    }
    
    if (!data || data.length === 0) {
      showEmpty();
      return;
    }
    
    renderRows(data);
    showTable();
    
    const myRow = data.find(r => r.user_id === currentUserId);
    if (myRow) {
      console.log(`📊 Kamu di rank #${myRow.rank} (${period})`);
    }
  } catch (e) {
    console.error('❌ Unexpected error:', e);
    showEmpty();
  }
}

// ===== INIT =====
(async function init() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    currentUserId = user.id;
    console.log(`👤 Current user: ${currentUserId.slice(0, 8)}...`);
  }
  
  loadLeaderboard('daily');
})();
/* =========================================
   KATAKATLA — LEADERBOARD
   Phase 4C: Fetch & render top 50 (harian/mingguan/bulanan)
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

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  }
  return `${minutes}m ${seconds}d`;
}

function renderRows(rows) {
  tbodyEl.innerHTML = '';
  
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.user_id === currentUserId) {
      tr.classList.add('is-me');
    }
    
    tr.innerHTML = `
      <td class="col-rank">${row.rank}</td>
      <td class="col-name">${escapeHtml(row.username)}</td>
      <td class="col-solved">${row.games_solved}/5</td>
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
    
    // Cek user di rank berapa
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
  // Ambil current user untuk highlight di tabel
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    currentUserId = user.id;
    console.log(`👤 Current user: ${currentUserId.slice(0, 8)}...`);
  }
  
  loadLeaderboard('daily');
})();
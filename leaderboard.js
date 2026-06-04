/* =========================================
   KATAKATLA — LEADERBOARD
   v3: Formal Indonesian + earthy avatar palette
========================================= */

const tabsEl = document.querySelectorAll('.lb-tab');
const infoEl = document.getElementById('lb-info');
const loadingEl = document.getElementById('lb-loading');
const tableEl = document.getElementById('lb-table');
const tbodyEl = document.getElementById('lb-tbody');
const emptyEl = document.getElementById('lb-empty');
const myRankEl = document.getElementById('lb-my-rank');
const myRankTbodyEl = document.getElementById('lb-my-rank-tbody');
const navPrevEl = document.getElementById('lb-nav-prev');
const navNextEl = document.getElementById('lb-nav-next');

let currentPeriod = 'daily';
let currentUserId = null;
let cursor = null;

const PERIOD_LABEL = {
  daily: 'Hari Ini',
  weekly: 'Minggu Ini',
  monthly: 'Bulan Ini',
  yearly: 'Tahun Ini',
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MIN_DATE = new Date('2026-01-01');

// 8 warna earthy yang sevibes palette baru
const AVATAR_COLORS = [
  '#C76F5A',  // terracotta
  '#739B8D',  // sage cyan
  '#D4A22B',  // mustard yellow
  '#8B6F9E',  // dusty mauve
  '#C28E94',  // dusty rose
  '#94A847',  // olive green
  '#D17B3F',  // burnt orange
  '#6B829E'   // dusty blue
];

function getAvatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash + username.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

function getInitial(username) {
  return username.charAt(0).toUpperCase();
}

function getWIBDate() {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibTime = new Date(now.getTime() + wibOffset);
  return wibTime.toISOString().split('T')[0];
}

function setActiveTab(period) {
  tabsEl.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.period === period);
  });
  currentPeriod = period;
  cursor = null;
  loadLeaderboard();
}

tabsEl.forEach(tab => {
  tab.addEventListener('click', () => setActiveTab(tab.dataset.period));
});

navPrevEl.addEventListener('click', () => navigatePeriod(-1));
navNextEl.addEventListener('click', () => navigatePeriod(1));

function navigatePeriod(direction) {
  if (currentPeriod === 'daily') {
    const baseDate = cursor ? new Date(cursor) : new Date(getWIBDate());
    baseDate.setDate(baseDate.getDate() + direction);
    cursor = baseDate.toISOString().split('T')[0];
    if (cursor === getWIBDate()) cursor = null;
  }
  else if (currentPeriod === 'weekly') {
    const baseDate = cursor ? new Date(cursor) : new Date(getWIBDate());
    baseDate.setDate(baseDate.getDate() + (direction * 7));
    cursor = baseDate.toISOString().split('T')[0];
    if (isSameWeek(new Date(cursor), new Date(getWIBDate()))) cursor = null;
  }
  else if (currentPeriod === 'monthly') {
    const now = new Date();
    const baseYear = cursor ? cursor.year : now.getFullYear();
    const baseMonth = cursor ? cursor.month : (now.getMonth() + 1);
    
    let newMonth = baseMonth + direction;
    let newYear = baseYear;
    
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    else if (newMonth > 12) { newMonth = 1; newYear += 1; }
    
    cursor = { year: newYear, month: newMonth };
    
    if (newYear === now.getFullYear() && newMonth === (now.getMonth() + 1)) {
      cursor = null;
    }
  }
  else if (currentPeriod === 'yearly') {
    const now = new Date();
    const baseYear = cursor ? cursor : now.getFullYear();
    const newYear = baseYear + direction;
    cursor = newYear;
    if (newYear === now.getFullYear()) cursor = null;
  }
  
  loadLeaderboard();
}

function isSameWeek(d1, d2) {
  const startOfWeek = (d) => {
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - (day - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  };
  return startOfWeek(d1).getTime() === startOfWeek(d2).getTime();
}

function getLabel() {
  if (currentPeriod === 'daily') {
    if (cursor === null) return 'Hari Ini';
    const d = new Date(cursor);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  
  if (currentPeriod === 'weekly') {
    if (cursor === null) return 'Minggu Ini';
    const d = new Date(cursor);
    const start = new Date(d);
    const day = d.getDay() || 7;
    start.setDate(d.getDate() - (day - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const startStr = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }
  
  if (currentPeriod === 'monthly') {
    if (cursor === null) return 'Bulan Ini';
    return `${MONTH_NAMES[cursor.month - 1]} ${cursor.year}`;
  }
  
  if (currentPeriod === 'yearly') {
    if (cursor === null) return 'Tahun Ini';
    return `Tahun ${cursor}`;
  }
  
  return '';
}

function updateNavButtons() {
  navNextEl.disabled = (cursor === null);
  
  let isPastMinDate = false;
  
  if (currentPeriod === 'daily') {
    const baseDate = cursor ? new Date(cursor) : new Date(getWIBDate());
    const testDate = new Date(baseDate);
    testDate.setDate(testDate.getDate() - 1);
    if (testDate < MIN_DATE) isPastMinDate = true;
  }
  else if (currentPeriod === 'weekly') {
    const baseDate = cursor ? new Date(cursor) : new Date(getWIBDate());
    const testDate = new Date(baseDate);
    testDate.setDate(testDate.getDate() - 7);
    if (testDate < MIN_DATE) isPastMinDate = true;
  }
  else if (currentPeriod === 'monthly') {
    const now = new Date();
    const baseYear = cursor ? cursor.year : now.getFullYear();
    const baseMonth = cursor ? cursor.month : (now.getMonth() + 1);
    let newMonth = baseMonth - 1;
    let newYear = baseYear;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    const testDate = new Date(newYear, newMonth - 1, 1);
    if (testDate < MIN_DATE) isPastMinDate = true;
  }
  else if (currentPeriod === 'yearly') {
    const baseYear = cursor ? cursor : new Date().getFullYear();
    if ((baseYear - 1) < 2026) isPastMinDate = true;
  }
  
  navPrevEl.disabled = isPastMinDate;
}

function showLoading() {
  loadingEl.classList.remove('hidden');
  tableEl.classList.add('hidden');
  emptyEl.classList.add('hidden');
  myRankEl.classList.add('hidden');
}

function showEmpty() {
  loadingEl.classList.add('hidden');
  tableEl.classList.add('hidden');
  emptyEl.classList.remove('hidden');
  myRankEl.classList.add('hidden');
}

function showTable() {
  loadingEl.classList.add('hidden');
  tableEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
}

function buildRowHtml(row, isMe = false) {
  const username = row.username || 'Anonim';
  const initial = getInitial(username);
  const color = getAvatarColor(username);
  
  const streakBadge = row.streak > 0 
    ? `<span class="streak-inline">🔥${row.streak}</span>` 
    : '';
  
  const meBadge = isMe ? '<span class="me-badge">Anda</span>' : '';
  
  return `
    <td class="col-rank">${row.rank}</td>
    <td class="col-name">
      <div class="name-cell">
        <span class="avatar-bubble" style="background:${color};">${initial}</span>
        <span class="name-text">${escapeHtml(username)}</span>
        ${streakBadge}
        ${meBadge}
      </div>
    </td>
    <td class="col-solved">${row.solved}/${row.played}</td>
    <td class="col-score">${row.total_score}</td>
  `;
}

function renderRows(rows) {
  tbodyEl.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    const isMe = row.user_id === currentUserId;
    if (isMe) tr.classList.add('is-me');
    tr.innerHTML = buildRowHtml(row, isMe);
    tbodyEl.appendChild(tr);
  }
}

function renderMyRank(row) {
  myRankTbodyEl.innerHTML = '';
  const tr = document.createElement('tr');
  tr.classList.add('is-me');
  tr.innerHTML = buildRowHtml(row, true);
  myRankTbodyEl.appendChild(tr);
  myRankEl.classList.remove('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadLeaderboard() {
  showLoading();
  
  infoEl.innerHTML = `Peringkat <span class="lb-info-current">${getLabel()}</span> · Top 50`;
  updateNavButtons();
  
  const fnName = getFnName();
  const params = getFnParams();
  
  try {
    const { data, error } = await supabaseClient.rpc(fnName, params);
    
    if (error) {
      console.error(`❌ Gagal fetch ${currentPeriod}:`, error.message);
      infoEl.textContent = `Kesalahan: ${error.message}`;
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
      console.log(`📊 Kamu di rank #${myRow.rank} (${currentPeriod})`);
      myRankEl.classList.add('hidden');
    } else if (currentUserId) {
      await loadMyRank();
    }
  } catch (e) {
    console.error('❌ Unexpected error:', e);
    showEmpty();
  }
}

function getFnName() {
  if (cursor === null) {
    return {
      daily: 'get_leaderboard_daily',
      weekly: 'get_leaderboard_weekly',
      monthly: 'get_leaderboard_monthly',
      yearly: 'get_leaderboard_yearly',
    }[currentPeriod];
  }
  return {
    daily: 'get_leaderboard_daily_at',
    weekly: 'get_leaderboard_weekly_at',
    monthly: 'get_leaderboard_monthly_at',
    yearly: 'get_leaderboard_yearly_at',
  }[currentPeriod];
}

function getFnParams() {
  if (cursor === null) return {};
  
  if (currentPeriod === 'daily' || currentPeriod === 'weekly') {
    return { p_date: cursor };
  }
  if (currentPeriod === 'monthly') {
    return { p_year: cursor.year, p_month: cursor.month };
  }
  if (currentPeriod === 'yearly') {
    return { p_year: cursor };
  }
  return {};
}

async function loadMyRank() {
  let dateFilter;
  const today = getWIBDate();
  
  if (currentPeriod === 'daily') {
    const targetDate = cursor || today;
    dateFilter = { eq: targetDate };
  } else if (currentPeriod === 'weekly') {
    const baseDate = cursor ? new Date(cursor) : new Date(today);
    const day = baseDate.getDay() || 7;
    const start = new Date(baseDate);
    start.setDate(baseDate.getDate() - (day - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    dateFilter = { 
      gte: start.toISOString().split('T')[0],
      lte: end.toISOString().split('T')[0]
    };
  } else if (currentPeriod === 'monthly') {
    const now = new Date();
    const year = cursor ? cursor.year : now.getFullYear();
    const month = cursor ? cursor.month : (now.getMonth() + 1);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    dateFilter = {
      gte: start.toISOString().split('T')[0],
      lte: end.toISOString().split('T')[0]
    };
  } else if (currentPeriod === 'yearly') {
    const year = cursor || new Date().getFullYear();
    dateFilter = {
      gte: `${year}-01-01`,
      lte: `${year}-12-31`
    };
  }
  
  let query = supabaseClient
    .from('attempts')
    .select('user_id, score, is_solved');
  
  if (dateFilter.eq) {
    query = query.eq('play_date', dateFilter.eq);
  } else {
    query = query.gte('play_date', dateFilter.gte).lte('play_date', dateFilter.lte);
  }
  
  const { data: attempts, error } = await query;
  
  if (error || !attempts) {
    console.error('❌ Gagal load my rank:', error?.message);
    return;
  }
  
  const userStats = {};
  attempts.forEach(a => {
    if (!userStats[a.user_id]) {
      userStats[a.user_id] = { total_score: 0, played: 0, solved: 0 };
    }
    userStats[a.user_id].total_score += a.score || 0;
    userStats[a.user_id].played += 1;
    if (a.is_solved) userStats[a.user_id].solved += 1;
  });
  
  const sorted = Object.entries(userStats)
    .map(([uid, s]) => ({ user_id: uid, ...s }))
    .sort((a, b) => b.total_score - a.total_score);
  
  const myIdx = sorted.findIndex(s => s.user_id === currentUserId);
  if (myIdx === -1) return;
  
  const myStats = sorted[myIdx];
  
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('username')
    .eq('id', currentUserId)
    .single();
  
  const { data: stats } = await supabaseClient.rpc('get_user_stats', {
    p_user_id: currentUserId
  });
  
  const myRow = {
    rank: myIdx + 1,
    user_id: currentUserId,
    username: profile?.username || 'Anonim',
    total_score: myStats.total_score,
    played: myStats.played,
    solved: myStats.solved,
    streak: stats?.streak || 0,
  };
  
  renderMyRank(myRow);
}

(async function init() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    currentUserId = user.id;
    console.log(`👤 Current user: ${currentUserId.slice(0, 8)}...`);
  }
  
  loadLeaderboard();
})();
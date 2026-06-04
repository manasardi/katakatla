/* =========================================
   KATAKATLA — STATS PERSONAL
   v3: Formal Indonesian copy text
========================================= */

const loadingEl = document.getElementById('stats-loading');
const contentEl = document.getElementById('stats-content');
const emptyEl = document.getElementById('stats-empty');

const profileUsernameEl = document.getElementById('profile-username');
const profileMetaEl = document.getElementById('profile-meta');
const statPlayedEl = document.getElementById('stat-played');
const statWinrateEl = document.getElementById('stat-winrate');
const statScoreEl = document.getElementById('stat-score');
const statStreakEl = document.getElementById('stat-streak');
const distributionEl = document.getElementById('distribution-chart');
const recentDaysEl = document.getElementById('recent-days');

const editBtnEl = document.getElementById('edit-username-btn');
const editModalEl = document.getElementById('edit-username-modal');
const editCloseEl = document.getElementById('edit-username-close');
const editCancelEl = document.getElementById('edit-username-cancel');
const editSaveEl = document.getElementById('edit-username-save');
const editInputEl = document.getElementById('edit-username-input');
const editErrorEl = document.getElementById('edit-username-error');

let currentUser = null;
let currentUsername = null;

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short' 
  });
}

function renderProfile(username) {
  profileUsernameEl.textContent = username || 'Pemain Anonim';
  currentUsername = username;
}

function renderHero(stats) {
  statPlayedEl.textContent = stats.total_played;
  statWinrateEl.innerHTML = `${stats.win_rate}<span class="hero-unit">%</span>`;
  statScoreEl.textContent = stats.total_score;
}

function renderStreak(streak) {
  statStreakEl.textContent = streak === 1 ? '1 hari' : `${streak} hari`;
}

function renderDistribution(distribution) {
  const values = Object.values(distribution).map(v => parseInt(v) || 0);
  const maxValue = Math.max(...values, 1);
  
  let html = '';
  for (let i = 1; i <= 6; i++) {
    const count = parseInt(distribution[i]) || 0;
    const widthPercent = (count / maxValue) * 100;
    
    html += `
      <div class="dist-row">
        <div class="dist-label">${i}</div>
        <div class="dist-bar-wrapper">
          <div class="dist-bar" style="width: ${widthPercent}%">
            <span class="dist-count">${count}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  distributionEl.innerHTML = html;
}

function renderRecentDays(days) {
  if (!days || days.length === 0) {
    recentDaysEl.innerHTML = '<p class="empty-note">Belum ada riwayat</p>';
    return;
  }
  
  const html = days.map(d => `
    <div class="recent-row">
      <div class="recent-date">${formatDate(d.date)}</div>
      <div class="recent-meta">
        <span class="recent-solved">${d.games_solved}/${d.games_played} menang</span>
      </div>
      <div class="recent-score">${d.total_score}</div>
    </div>
  `).join('');
  
  recentDaysEl.innerHTML = html;
}

async function loadProfileData() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  
  currentUser = user;
  
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username, username_changed_at')
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('❌ Gagal load profile:', error.message);
    return null;
  }
  
  return data;
}

async function loadStats() {
  if (!currentUser) {
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  
  console.log(`📊 Loading stats for user ${currentUser.id.slice(0, 8)}...`);
  
  const { data, error } = await supabaseClient.rpc('get_user_stats', {
    p_user_id: currentUser.id
  });
  
  if (error) {
    console.error('❌ Gagal fetch stats:', error.message);
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  
  if (!data || data.total_played === 0) {
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  
  console.log('📊 Stats loaded:', data);
  
  renderHero(data);
  renderStreak(data.streak);
  renderDistribution(data.distribution);
  renderRecentDays(data.recent_days);
  
  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

// ===== EDIT USERNAME MODAL =====
function openEditModal() {
  editInputEl.value = currentUsername || '';
  editErrorEl.textContent = '';
  editModalEl.classList.remove('hidden');
  setTimeout(() => editInputEl.focus(), 100);
}

function closeEditModal() {
  editModalEl.classList.add('hidden');
}

async function saveNewUsername() {
  const newUsername = editInputEl.value.trim();
  
  if (newUsername === currentUsername) {
    editErrorEl.textContent = 'Username belum diubah';
    return;
  }
  
  // Client-side validation (server-side juga validate)
  if (newUsername.length < 3 || newUsername.length > 20) {
    editErrorEl.textContent = 'Username harus 3-20 karakter';
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    editErrorEl.textContent = 'Hanya huruf, angka, dan garis bawah';
    return;
  }
  
  editSaveEl.disabled = true;
  editSaveEl.textContent = 'Menyimpan...';
  editErrorEl.textContent = '';
  
  const { data, error } = await supabaseClient.rpc('change_username', {
    p_new_username: newUsername
  });
  
  editSaveEl.disabled = false;
  editSaveEl.textContent = 'Simpan';
  
  if (error) {
    console.error('❌ RPC error:', error);
    editErrorEl.textContent = 'Kesalahan sistem, silakan coba lagi';
    return;
  }
  
  if (!data.success) {
    editErrorEl.textContent = data.error || 'Gagal menyimpan';
    return;
  }
  
  // Success
  console.log(`✅ Username updated to: ${newUsername}`);
  renderProfile(newUsername);
  closeEditModal();
  
  alert(`Username berhasil diubah menjadi ${newUsername}`);
}

// Setup event listeners
if (editBtnEl) editBtnEl.addEventListener('click', openEditModal);
if (editCloseEl) editCloseEl.addEventListener('click', closeEditModal);
if (editCancelEl) editCancelEl.addEventListener('click', closeEditModal);
if (editSaveEl) editSaveEl.addEventListener('click', saveNewUsername);
if (editInputEl) {
  editInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNewUsername();
  });
}

// Backdrop + Esc close
if (editModalEl) {
  editModalEl.addEventListener('click', (e) => {
    if (e.target === editModalEl) closeEditModal();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editModalEl && !editModalEl.classList.contains('hidden')) {
    closeEditModal();
  }
});

// Init
(async function init() {
  const profile = await loadProfileData();
  if (profile) {
    renderProfile(profile.username);
  }
  await loadStats();
})();
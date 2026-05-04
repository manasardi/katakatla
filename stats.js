/* =========================================
   KATAKATLA — STATS PERSONAL
========================================= */

const loadingEl = document.getElementById('stats-loading');
const contentEl = document.getElementById('stats-content');
const emptyEl = document.getElementById('stats-empty');

const statPlayedEl = document.getElementById('stat-played');
const statWinrateEl = document.getElementById('stat-winrate');
const statScoreEl = document.getElementById('stat-score');
const statStreakEl = document.getElementById('stat-streak');
const distributionEl = document.getElementById('distribution-chart');
const recentDaysEl = document.getElementById('recent-days');

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short' 
  });
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
  // Find max value for scaling bars
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
    recentDaysEl.innerHTML = '<p class="empty-note">belum ada riwayat</p>';
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

async function loadStats() {
  // Get current user
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    console.error('❌ No user session');
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  
  console.log(`📊 Loading stats for user ${user.id.slice(0, 8)}...`);
  
  const { data, error } = await supabaseClient.rpc('get_user_stats', {
    p_user_id: user.id
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

// Init
loadStats();
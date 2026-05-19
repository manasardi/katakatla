/* =========================================
   KATAKATLA — ADMIN CURATION PAGE
========================================= */

const PASSWORD_HASH = '47391e93f6a529875fcd9f347398d01a5f40979861453d46ad00a5414ea8590b';
const PAGE_SIZE = 50;

// ===== DOM =====
const authGate = document.getElementById('auth-gate');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authSubmit = document.getElementById('auth-submit');
const adminPage = document.getElementById('admin-page');

const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statValid = document.getElementById('stat-valid');
const statBlacklist = document.getElementById('stat-blacklist');

const searchInput = document.getElementById('search-input');
const filterTabs = document.querySelectorAll('.filter-tab');
const wordsLoading = document.getElementById('words-loading');
const wordsList = document.getElementById('words-list');
const wordsEmpty = document.getElementById('words-empty');

const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

const mainTabs = document.querySelectorAll('.main-tab');
const wordsControls = document.getElementById('words-controls');
const reportsView = document.getElementById('reports-view');
const reportsLoading = document.getElementById('reports-loading');
const reportsList = document.getElementById('reports-list');
const reportsEmpty = document.getElementById('reports-empty');
const reportsBadge = document.getElementById('reports-badge');

// ===== STATE =====
let allWords = [];
let filteredWords = [];
let currentPage = 0;
let currentFilter = 'all';
let currentSearch = '';

// ===== AUTH =====
async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPassword() {
  const pwd = authPassword.value;
  if (!pwd) {
    authError.textContent = 'password kosong';
    return;
  }
  const hash = await hashPassword(pwd);
  if (hash === PASSWORD_HASH) {
    sessionStorage.setItem('katakatla_admin', 'true');
    authGate.classList.add('hidden');
    adminPage.classList.remove('hidden');
    loadAllWords();
    loadReportsCount();
  } else {
    authError.textContent = 'password salah';
    authPassword.value = '';
  }
}

authSubmit.addEventListener('click', checkPassword);
authPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkPassword();
});

// Auto-login kalau session masih aktif
if (sessionStorage.getItem('katakatla_admin') === 'true') {
  authGate.classList.add('hidden');
  adminPage.classList.remove('hidden');
  setTimeout(() => {
    loadAllWords();
    loadReportsCount();
  }, 100);
} else {
  setTimeout(() => authPassword.focus(), 100);
}

// ===== LOAD WORDS =====
async function loadAllWords() {
  wordsLoading.classList.remove('hidden');
  wordsList.classList.add('hidden');
  wordsEmpty.classList.add('hidden');
  pagination.classList.add('hidden');

  allWords = [];
  let page = 0;
  
  while (true) {
    const from = page * 1000;
    const to = from + 999;
    
    const { data, error } = await supabaseClient
      .from('words')
      .select('id, word, curation_status, curation_note, is_common')
      .order('word', { ascending: true })
      .range(from, to);
    
    if (error) {
      console.error('❌ Gagal load words:', error.message);
      wordsLoading.textContent = 'gagal load. cek console.';
      return;
    }
    
    if (!data || data.length === 0) break;
    
    allWords.push(...data);
    
    if (data.length < 1000) break;
    page++;
  }
  
  console.log(`📖 ${allWords.length} kata loaded`);
  updateStats();
  applyFilter();
}

// ===== STATS =====
function updateStats() {
  const total = allWords.length;
  const pending = allWords.filter(w => w.curation_status === 'pending' || !w.curation_status).length;
  const valid = allWords.filter(w => w.curation_status === 'valid').length;
  const blacklist = allWords.filter(w => w.curation_status === 'blacklist').length;
  
  statTotal.textContent = total;
  statPending.textContent = pending;
  statValid.textContent = valid;
  statBlacklist.textContent = blacklist;
}

// ===== FILTER & SEARCH =====
function applyFilter() {
  filteredWords = allWords.filter(w => {
    const status = w.curation_status || 'pending';
    const matchFilter = currentFilter === 'all' || status === currentFilter;
    const matchSearch = !currentSearch || w.word.includes(currentSearch);
    return matchFilter && matchSearch;
  });
  currentPage = 0;
  renderWords();
}

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    applyFilter();
  });
});

searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value.toLowerCase().trim();
  applyFilter();
});

// ===== RENDER =====
function renderWords() {
  wordsLoading.classList.add('hidden');
  
  if (filteredWords.length === 0) {
    wordsList.classList.add('hidden');
    wordsEmpty.classList.remove('hidden');
    pagination.classList.add('hidden');
    return;
  }
  
  wordsEmpty.classList.add('hidden');
  wordsList.classList.remove('hidden');
  
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageWords = filteredWords.slice(start, end);
  
  wordsList.innerHTML = pageWords.map(w => {
    const status = w.curation_status || 'pending';
    return `
      <div class="word-card status-${status}" data-id="${w.id}">
        <div class="word-text">${w.word}</div>
        <div class="word-actions">
          <button class="word-btn btn-valid ${status === 'valid' ? 'active-valid' : ''}" 
                  data-action="valid" data-id="${w.id}" type="button">✓ valid</button>
          <button class="word-btn btn-blacklist ${status === 'blacklist' ? 'active-blacklist' : ''}" 
                  data-action="blacklist" data-id="${w.id}" type="button">✕ blacklist</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  wordsList.querySelectorAll('.word-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      updateWordStatus(id, action);
    });
  });
  
  // Pagination
  const totalPages = Math.ceil(filteredWords.length / PAGE_SIZE);
  if (totalPages > 1) {
    pagination.classList.remove('hidden');
    pageInfo.textContent = `halaman ${currentPage + 1} dari ${totalPages}`;
    prevPageBtn.disabled = currentPage === 0;
    nextPageBtn.disabled = currentPage >= totalPages - 1;
    prevPageBtn.style.opacity = currentPage === 0 ? '0.4' : '1';
    nextPageBtn.style.opacity = currentPage >= totalPages - 1 ? '0.4' : '1';
  } else {
    pagination.classList.add('hidden');
  }
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    renderWords();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

nextPageBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredWords.length / PAGE_SIZE);
  if (currentPage < totalPages - 1) {
    currentPage++;
    renderWords();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// ===== UPDATE STATUS =====
async function updateWordStatus(id, newStatus) {
  const word = allWords.find(w => w.id === id);
  if (!word) return;
  
  // Toggle: kalau klik status yang sama, kembali ke pending
  const finalStatus = (word.curation_status === newStatus) ? 'pending' : newStatus;
  
  const { error } = await supabaseClient
    .from('words')
    .update({ curation_status: finalStatus })
    .eq('id', id);
  
  if (error) {
    console.error('❌ Update gagal:', error.message);
    alert('gagal update, cek console');
    return;
  }
  
  // Update local state
  word.curation_status = finalStatus;
  word.is_common = (finalStatus === 'blacklist') ? false : (finalStatus === 'valid' ? true : word.is_common);
  
  updateStats();
  renderWords();
}

// ===== MAIN TABS =====
mainTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    mainTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const tabName = tab.dataset.tab;
    if (tabName === 'words') {
      wordsControls.classList.remove('hidden');
      wordsList.classList.remove('hidden');
      wordsLoading.classList.remove('hidden');
      reportsView.classList.add('hidden');
      renderWords();
    } else {
      wordsControls.classList.add('hidden');
      wordsList.classList.add('hidden');
      wordsLoading.classList.add('hidden');
      wordsEmpty.classList.add('hidden');
      pagination.classList.add('hidden');
      reportsView.classList.remove('hidden');
      loadReports();
    }
  });
});

// ===== LOAD REPORTS COUNT (badge) =====
async function loadReportsCount() {
  const { count, error } = await supabaseClient
    .from('word_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reviewed', false);
  
  if (error) {
    console.error('❌ Gagal load reports count:', error.message);
    return;
  }
  
  if (count > 0) {
    reportsBadge.textContent = count;
    reportsBadge.classList.remove('hidden');
  } else {
    reportsBadge.classList.add('hidden');
  }
}

// ===== LOAD REPORTS LIST =====
async function loadReports() {
  reportsLoading.classList.remove('hidden');
  reportsList.classList.add('hidden');
  reportsEmpty.classList.add('hidden');
  
  // Aggregate reports per kata
  const { data, error } = await supabaseClient
    .from('word_reports')
    .select('word_id, word, reported_at, reviewed')
    .eq('reviewed', false)
    .order('reported_at', { ascending: false });
  
  if (error) {
    console.error('❌ Gagal load reports:', error.message);
    reportsLoading.textContent = 'gagal load, cek console.';
    return;
  }
  
  reportsLoading.classList.add('hidden');
  
  if (!data || data.length === 0) {
    reportsEmpty.classList.remove('hidden');
    return;
  }
  
  // Group by word_id, count reports
  const grouped = {};
  data.forEach(r => {
    if (!grouped[r.word_id]) {
      grouped[r.word_id] = { 
        word_id: r.word_id, 
        word: r.word, 
        count: 0, 
        latest: r.reported_at 
      };
    }
    grouped[r.word_id].count++;
  });
  
  const reports = Object.values(grouped).sort((a, b) => b.count - a.count);
  
  reportsList.classList.remove('hidden');
  reportsList.innerHTML = reports.map(r => {
    const dateStr = new Date(r.latest).toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    });
    return `
      <div class="report-card" data-word-id="${r.word_id}">
        <div class="report-info">
          <span class="report-word">${r.word}</span>
          <span class="report-meta">dilaporkan ${r.count}× · terakhir ${dateStr}</span>
        </div>
        <div class="report-actions">
          <button class="report-btn btn-blacklist-action" data-action="blacklist" data-word-id="${r.word_id}" type="button">✕ blacklist</button>
          <button class="report-btn btn-dismiss" data-action="dismiss" data-word-id="${r.word_id}" type="button">abaikan</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  reportsList.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wordId = parseInt(btn.dataset.wordId);
      const action = btn.dataset.action;
      handleReportAction(wordId, action);
    });
  });
}

// ===== HANDLE REPORT ACTION =====
async function handleReportAction(wordId, action) {
  if (action === 'blacklist') {
    // Update kata jadi blacklist
    const { error: updateError } = await supabaseClient
      .from('words')
      .update({ curation_status: 'blacklist' })
      .eq('id', wordId);
    
    if (updateError) {
      console.error('❌ Blacklist gagal:', updateError.message);
      alert('gagal blacklist, cek console');
      return;
    }
  }
  
  // Mark semua report untuk kata ini sebagai reviewed
  const { error: reviewError } = await supabaseClient
    .from('word_reports')
    .update({ reviewed: true })
    .eq('word_id', wordId);
  
  if (reviewError) {
    console.error('❌ Mark reviewed gagal:', reviewError.message);
    alert('gagal update report, cek console');
    return;
  }
  
  // Reload
  await loadReports();
  await loadReportsCount();
  // Update local cache kalau ada
  const word = allWords.find(w => w.id === wordId);
  if (word && action === 'blacklist') {
    word.curation_status = 'blacklist';
    word.is_common = false;
    updateStats();
  }
}
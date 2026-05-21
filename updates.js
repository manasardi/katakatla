/* =========================================
   KATAKATLA — UPDATES PAGE
========================================= */

const updatesLoading = document.getElementById('updates-loading');
const updatesList = document.getElementById('updates-list');
const updatesEmpty = document.getElementById('updates-empty');

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

async function loadUpdates() {
  const { data, error } = await supabaseClient
    .from('changelog')
    .select('*')
    .order('release_date', { ascending: false })
    .order('version', { ascending: false });
  
  if (error) {
    console.error('❌ Gagal load updates:', error.message);
    updatesLoading.textContent = 'gagal memuat. coba refresh.';
    return;
  }
  
  updatesLoading.classList.add('hidden');
  
  if (!data || data.length === 0) {
    updatesEmpty.classList.remove('hidden');
    return;
  }
  
  updatesList.classList.remove('hidden');
  updatesList.innerHTML = data.map((entry, idx) => {
    const isLatest = idx === 0;
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    
    return `
      <article class="update-entry ${isLatest ? 'is-latest' : ''}">
        <header class="update-header">
          <div class="update-version-row">
            <span class="update-version">${entry.version}</span>
            ${isLatest ? '<span class="update-latest-badge">terbaru</span>' : ''}
          </div>
          <h2 class="update-title">${entry.title}</h2>
          <time class="update-date">${formatDate(entry.release_date)}</time>
        </header>
        <ul class="update-changes">
          ${changes.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </article>
    `;
  }).join('');
}

loadUpdates();
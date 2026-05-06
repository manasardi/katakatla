/* =========================================
   KATAKATLA — GAME LOGIC
   Phase 4 + 15 + 16 + 17 + persist + howto + history nav
========================================= */

// ===== KONFIGURASI =====
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const TOTAL_SLOTS = 5;
const USERNAME_ASKED_KEY = 'katakatla_username_asked';
const HOWTO_SEEN_KEY = 'katakatla_howto_seen';
let viewingSlot = null;  // null = mode normal, number = mode preview

// Daily words: array dari 5 slot
let dailyWords = [];

// Validation: semua kata valid (Set buat O(1) lookup)
let validWords = new Set();

// ===== HISTORY HELPERS (localStorage) =====
function getHistoryKey(date, slot) {
  return `katakatla_history_${date}_slot${slot}`;
}

function saveHistory(slot, guesses) {
  const today = new Date().toISOString().split('T')[0];
  const key = getHistoryKey(today, slot);
  localStorage.setItem(key, JSON.stringify(guesses));
}

function loadHistory(slot) {
  const today = new Date().toISOString().split('T')[0];
  const key = getHistoryKey(today, slot);
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

function renderHistoryToGrid(guesses, targetWord) {
  guesses.forEach((guess, rowIdx) => {
    const target = targetWord.split('');
    const result = ['absent','absent','absent','absent','absent'];
    const targetCounts = {};
    for (const ch of target) targetCounts[ch] = (targetCounts[ch] || 0) + 1;

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guess[i] === target[i]) {
        result[i] = 'correct';
        targetCounts[guess[i]]--;
      }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === 'absent' && targetCounts[guess[i]] > 0) {
        result[i] = 'present';
        targetCounts[guess[i]]--;
      }
    }
    
    for (let i = 0; i < WORD_LENGTH; i++) {
      const tile = getTile(rowIdx, i);
      tile.textContent = guess[i];
      tile.classList.add('filled', result[i]);
    }
    
    updateKeyboardColors(guess, result);
  });
}

function clearGrid() {
  gridEl.querySelectorAll('.tile').forEach(tile => {
    tile.textContent = '';
    tile.className = 'tile';
  });
  keyboardEl.querySelectorAll('.kb-key').forEach(key => {
    key.classList.remove('correct', 'present', 'absent');
  });
}

function previewSlot(slotNum) {
  const guesses = loadHistory(slotNum);
  const target = dailyWords.find(w => w.slot === slotNum);
  
  if (!guesses || !target) {
    showToast('belum ada riwayat di slot ini');
    return;
  }
  
  clearGrid();
  renderHistoryToGrid(guesses, target.word);
  viewingSlot = slotNum;
  
  state.isGameOver = true;  // disable input saat preview
  
  showToast(`riwayat slot ${slotNum}`);
}

function exitPreviewMode() {
  if (viewingSlot === null) return;
  
  viewingSlot = null;
  clearGrid();
  
  const currentGuesses = loadHistory(state.currentSlot);
  const currentTarget = getCurrentTarget();
  
  if (currentGuesses && currentTarget) {
    state.guesses = currentGuesses;
    state.currentRow = currentGuesses.length;
    renderHistoryToGrid(currentGuesses, currentTarget.word);
  }
  
  if (!state.isDayComplete && state.currentRow < MAX_GUESSES) {
    state.isGameOver = false;
  }
}

async function loadDailyWords() {
  const { data, error } = await supabaseClient.rpc('get_daily_words');
  if (error) {
    console.error('❌ Gagal fetch daily words:', error.message);
    showToast('gagal load kata. coba refresh.');
    return false;
  }
  if (!data || data.length === 0) {
    console.error('❌ Daily words kosong');
    return false;
  }
  dailyWords = data.sort((a, b) => a.slot - b.slot);
  console.log(`🎯 ${dailyWords.length} kata harian loaded`);
  return true;
}

async function loadValidWords() {
  validWords = new Set();
  const PAGE_SIZE = 1000;
  let page = 0;
  
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error } = await supabaseClient
      .from('words')
      .select('word')
      .range(from, to);
    
    if (error) {
      console.error('❌ Gagal load valid words:', error.message);
      return false;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(w => validWords.add(w.word));
    
    if (data.length < PAGE_SIZE) break;
    
    page++;
  }
  
  console.log(`📖 ${validWords.size} kata valid loaded`);
  return true;
}

async function loadUserProgress() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return [];
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabaseClient
    .from('attempts')
    .select('slot')
    .eq('user_id', user.id)
    .eq('play_date', today);
  
  if (error) {
    console.error('❌ Gagal load progress:', error.message);
    return [];
  }
  
  const completedSlots = data.map(a => a.slot).sort();
  console.log(`📊 Slots completed hari ini:`, completedSlots);
  return completedSlots;
}

async function loadStreak() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return 0;
  
  const { data, error } = await supabaseClient.rpc('get_user_stats', {
    p_user_id: user.id
  });
  
  if (error) {
    console.error('❌ Gagal load streak:', error.message);
    return 0;
  }
  
  return (data && data.streak) ? data.streak : 0;
}

function updateStreakBadge(streak) {
  const badge = document.getElementById('streak-badge');
  const countEl = document.getElementById('streak-count');
  
  if (!badge || !countEl) return;
  
  if (streak > 0) {
    countEl.textContent = streak;
    badge.classList.remove('streak-hidden');
  } else {
    badge.classList.add('streak-hidden');
  }
}

// ===== STATE =====
const state = {
  currentSlot: 1,
  currentRow: 0,
  currentCol: 0,
  guesses: [],
  isGameOver: false,
  startTime: null,
  isDayComplete: false,
};

function getCurrentTarget() {
  return dailyWords.find(w => w.slot === state.currentSlot);
}

function resetForNextSlot() {
  state.currentRow = 0;
  state.currentCol = 0;
  state.guesses = [];
  state.isGameOver = false;
  state.startTime = null;
  
  gridEl.querySelectorAll('.tile').forEach(tile => {
    tile.textContent = '';
    tile.className = 'tile';
  });
  
  keyboardEl.querySelectorAll('.kb-key').forEach(key => {
    key.classList.remove('correct', 'present', 'absent');
  });
  
  modalEl.classList.add('hidden');
}

// ===== DOM =====
const gridEl = document.getElementById('grid');
const keyboardEl = document.getElementById('keyboard');
const toastEl = document.getElementById('toast');
const modalEl = document.getElementById('modal');
const modalTitleEl = document.getElementById('modal-title');
const modalMessageEl = document.getElementById('modal-message');
const modalButtonEl = document.getElementById('modal-button');
const modalShareBtnEl = document.getElementById('modal-share-btn');
const usernameModalEl = document.getElementById('username-modal');
const usernameInputEl = document.getElementById('username-input');
const usernameErrorEl = document.getElementById('username-error');
const usernameSetBtnEl = document.getElementById('username-set-btn');
const usernameSkipBtnEl = document.getElementById('username-skip-btn');

// ===== BUILD UI =====
function buildGrid() {
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = r;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = r;
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    gridEl.appendChild(row);
  }
}

function buildKeyboard() {
  const layout = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['enter','z','x','c','v','b','n','m','back']
  ];
  for (const rowKeys of layout) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    for (const key of rowKeys) {
      const keyEl = document.createElement('button');
      keyEl.className = 'kb-key';
      keyEl.dataset.key = key;
      if (key === 'enter') { keyEl.textContent = 'enter'; keyEl.classList.add('wide'); }
      else if (key === 'back') { keyEl.textContent = '⌫'; keyEl.classList.add('wide'); }
      else { keyEl.textContent = key; }
      keyEl.addEventListener('click', () => handleKey(key));
      row.appendChild(keyEl);
    }
    keyboardEl.appendChild(row);
  }
}

// ===== INPUT =====
function handleKey(key) {
  if (state.isGameOver) return;
  if (key === 'enter') submitGuess();
  else if (key === 'back') deleteLetter();
  else if (/^[a-z]$/.test(key)) addLetter(key);
}

function addLetter(letter) {
  if (state.currentCol >= WORD_LENGTH) return;
  if (state.startTime === null) {
    state.startTime = Date.now();
  }
  const tile = getTile(state.currentRow, state.currentCol);
  tile.textContent = letter;
  tile.classList.add('filled');
  state.currentCol++;
}

function deleteLetter() {
  if (state.currentCol === 0) return;
  state.currentCol--;
  const tile = getTile(state.currentRow, state.currentCol);
  tile.textContent = '';
  tile.classList.remove('filled');
}

function getTile(row, col) {
  return gridEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function getCurrentGuess() {
  let guess = '';
  for (let c = 0; c < WORD_LENGTH; c++) {
    guess += getTile(state.currentRow, c).textContent;
  }
  return guess;
}

// ===== SUBMIT & VALIDATE =====
function submitGuess() {
  if (state.currentCol < WORD_LENGTH) {
    showToast('kata kurang lengkap');
    shakeRow();
    return;
  }
  
  const target = getCurrentTarget();
  if (!target) {
    console.error('❌ No target word');
    return;
  }
  
  const guess = getCurrentGuess();
  
  if (!validWords.has(guess)) {
    showToast('kata tidak ada di kamus');
    shakeRow();
    return;
  }
  
  state.guesses.push(guess);
  saveHistory(state.currentSlot, state.guesses);
  colorTiles(guess, target.word);

  if (guess === target.word) {
    state.isGameOver = true;
    saveAttempt(true).then((attempt) => {
      setTimeout(() => showSlotEndModal(true, attempt), 3000);
    });
    return;
  }

  state.currentRow++;
  state.currentCol = 0;

  if (state.currentRow >= MAX_GUESSES) {
    state.isGameOver = true;
    saveAttempt(false).then(() => {
      setTimeout(() => showSlotEndModal(false, null), 3000);
    });
  }
}

function colorTiles(guess, targetWord) {
  const target = targetWord.split('');
  const result = ['absent','absent','absent','absent','absent'];
  const targetCounts = {};
  for (const ch of target) targetCounts[ch] = (targetCounts[ch] || 0) + 1;

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
      targetCounts[guess[i]]--;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'absent' && targetCounts[guess[i]] > 0) {
      result[i] = 'present';
      targetCounts[guess[i]]--;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    const tile = getTile(state.currentRow, i);
    setTimeout(() => tile.classList.add(result[i]), i * 500);
  }
  setTimeout(() => updateKeyboardColors(guess, result), WORD_LENGTH * 500);
}

function updateKeyboardColors(guess, result) {
  for (let i = 0; i < guess.length; i++) {
    const key = guess[i];
    const status = result[i];
    const keyEl = keyboardEl.querySelector(`[data-key="${key}"]`);
    if (!keyEl) continue;
    if (status === 'correct') {
      keyEl.classList.remove('present','absent');
      keyEl.classList.add('correct');
    } else if (status === 'present' && !keyEl.classList.contains('correct')) {
      keyEl.classList.remove('absent');
      keyEl.classList.add('present');
    } else if (status === 'absent' && !keyEl.classList.contains('correct') && !keyEl.classList.contains('present')) {
      keyEl.classList.add('absent');
    }
  }
}

// ===== FEEDBACK =====
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1500);
}

function shakeRow() {
  const row = gridEl.querySelector(`[data-row="${state.currentRow}"]`);
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 400);
}

// ===== SHARE =====
function buildShareText(isWin, attempt) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  
  const target = getCurrentTarget().word;
  const emojiGrid = state.guesses.map(guess => {
    const targetArr = target.split('');
    const result = ['⬛','⬛','⬛','⬛','⬛'];
    const targetCounts = {};
    for (const ch of targetArr) targetCounts[ch] = (targetCounts[ch] || 0) + 1;
    
    for (let i = 0; i < 5; i++) {
      if (guess[i] === targetArr[i]) {
        result[i] = '🟩';
        targetCounts[guess[i]]--;
      }
    }
    for (let i = 0; i < 5; i++) {
      if (result[i] === '⬛' && targetCounts[guess[i]] > 0) {
        result[i] = '🟨';
        targetCounts[guess[i]]--;
      }
    }
    return result.join('');
  }).join('\n');
  
  const guessesText = isWin 
    ? `${state.currentRow + 1}/6 tebakan` 
    : `gagal (6/6)`;
  
  const scoreText = (isWin && attempt) 
    ? `skor: ${attempt.score}` 
    : 'skor: 0';
  
  return `katakatla ${dateStr} — slot ${state.currentSlot}/${TOTAL_SLOTS}

${emojiGrid}

${scoreText} · ${guessesText}

main: katakatla.vercel.app`;
}

async function handleShare(isWin, attempt) {
  const text = buildShareText(isWin, attempt);
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'katakatla',
        text: text,
      });
      console.log('✅ Shared via Web Share');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Web Share gagal, fallback ke clipboard:', err);
    }
  }
  
  try {
    await navigator.clipboard.writeText(text);
    showToast('hasil disalin ke clipboard');
  } catch (err) {
    console.error('❌ Clipboard juga gagal:', err);
    showToast('gagal share, coba lagi');
  }
}

// ===== MODAL: end-of-slot =====
function showSlotEndModal(isWin, attempt) {
  stopCountdown();  // ← BARU: pastiin countdown nggak muncul di modal slot end biasa
  const target = getCurrentTarget();
  const isLastSlot = state.currentSlot >= TOTAL_SLOTS;
  
  modalTitleEl.textContent = isWin ? '🎉 menang!' : '😢 kalah';
  
  let message;
  if (isWin && attempt) {
    message = `kamu nemu kata "${target.word}" dalam ${state.currentRow + 1} tebakan. skor: ${attempt.score}.`;
  } else if (isWin) {
    message = `kamu nemu kata "${target.word}".`;
  } else {
    message = `kata-nya adalah "${target.word}".`;
  }
  
  message += ` (slot ${state.currentSlot} dari ${TOTAL_SLOTS})`;
  modalMessageEl.textContent = message;
  
  if (isLastSlot) {
    modalButtonEl.textContent = 'lihat hasilmu hari ini';
    modalButtonEl.onclick = () => {
      modalEl.classList.add('hidden');
      maybeShowUsernamePrompt(() => showDayCompleteModal());
    };
  } else {
    modalButtonEl.textContent = `lanjut slot ${state.currentSlot + 1} dari ${TOTAL_SLOTS} →`;
    modalButtonEl.onclick = () => {
      modalEl.classList.add('hidden');
      maybeShowUsernamePrompt(() => goToNextSlot());
    };
  }
  
  if (isWin && attempt) {
    modalShareBtnEl.classList.remove('hidden');
    modalShareBtnEl.onclick = () => handleShare(isWin, attempt);
  } else {
    modalShareBtnEl.classList.add('hidden');
  }
  
  modalEl.classList.remove('hidden');
}

function goToNextSlot() {
  state.currentSlot++;
  resetForNextSlot();
  console.log(`▶ Lanjut slot ${state.currentSlot}`);
}

function showDayCompleteModal() {
  state.isDayComplete = true;
  modalTitleEl.textContent = '🏆 selesai!';
  modalMessageEl.textContent = `kamu udah main 5 slot hari ini. balik lagi besok untuk kata-kata baru.`;
  modalButtonEl.textContent = 'tutup';
  modalButtonEl.onclick = () => {
    modalEl.classList.add('hidden');
    stopCountdown();
  };
  modalShareBtnEl.classList.add('hidden');
  startCountdown();  // ← BARU
  modalEl.classList.remove('hidden');
}

// ===== COUNTDOWN TIMER =====
let countdownInterval = null;
const countdownBlockEl = document.getElementById('countdown-block');
const countdownTimeEl = document.getElementById('countdown-time');

function getNextResetTime() {
  // Reset = UTC 00:00 = WIB 07:00
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  // Kalau sekarang udah lewat UTC midnight hari ini, set ke besok
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function formatCountdown(msUntilReset) {
  const totalMinutes = Math.floor(msUntilReset / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  } else if (minutes > 0) {
    return `${minutes} menit`;
  } else {
    const seconds = Math.floor((msUntilReset % 60000) / 1000);
    return `${seconds} detik`;
  }
}

function updateCountdown() {
  const reset = getNextResetTime();
  const now = new Date();
  const ms = reset - now;
  
  if (ms <= 0) {
    countdownTimeEl.textContent = 'segera!';
    return;
  }
  
  countdownTimeEl.textContent = formatCountdown(ms);
}

function startCountdown() {
  countdownBlockEl.classList.remove('hidden');
  updateCountdown();
  // Update tiap 30 detik (cukup, nggak perlu real-time per-detik)
  countdownInterval = setInterval(updateCountdown, 30000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  countdownBlockEl.classList.add('hidden');
}

// ===== USERNAME PROMPT =====
function maybeShowUsernamePrompt(onContinue) {
  const alreadyAsked = localStorage.getItem(USERNAME_ASKED_KEY) === 'true';
  const isAfterSlot1 = state.currentSlot === 1;
  
  if (alreadyAsked || !isAfterSlot1) {
    onContinue();
    return;
  }
  
  showUsernameModal(onContinue);
}

function showUsernameModal(onContinue) {
  usernameInputEl.value = '';
  usernameErrorEl.textContent = '';
  usernameModalEl.classList.remove('hidden');
  setTimeout(() => usernameInputEl.focus(), 100);
  
  usernameSetBtnEl.onclick = async () => {
    const username = usernameInputEl.value.trim();
    
    if (username.length < 3 || username.length > 20) {
      usernameErrorEl.textContent = 'username harus 3-20 karakter';
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      usernameErrorEl.textContent = 'cuma huruf, angka, underscore';
      return;
    }
    
    usernameSetBtnEl.disabled = true;
    usernameSetBtnEl.textContent = 'menyimpan...';
    
    const result = await updateUsername(username);
    
    usernameSetBtnEl.disabled = false;
    usernameSetBtnEl.textContent = 'set username';
    
    if (result.success) {
      localStorage.setItem(USERNAME_ASKED_KEY, 'true');
      usernameModalEl.classList.add('hidden');
      showToast(`username diset: ${username}`);
      onContinue();
    } else {
      usernameErrorEl.textContent = result.error;
    }
  };
  
  usernameSkipBtnEl.onclick = () => {
    localStorage.setItem(USERNAME_ASKED_KEY, 'true');
    usernameModalEl.classList.add('hidden');
    onContinue();
  };
}

async function updateUsername(newUsername) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return { success: false, error: 'session error, refresh aja' };
  
  const { error } = await supabaseClient
    .from('profiles')
    .update({ username: newUsername, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'username udah dipake orang lain' };
    }
    console.error('❌ Update username error:', error);
    return { success: false, error: 'gagal simpan, coba lagi' };
  }
  
  console.log(`✅ Username updated: ${newUsername}`);
  return { success: true };
}

// ===== PHYSICAL KEYBOARD =====
document.addEventListener('keydown', (e) => {
  if (!usernameModalEl.classList.contains('hidden')) {
    if (e.key === 'Enter') usernameSetBtnEl.click();
    return;
  }
  // Esc keluar dari preview mode
  if (e.key === 'Escape' && viewingSlot !== null) {
    exitPreviewMode();
    return;
  }
  if (state.isGameOver) return;
  if (e.key === 'Enter') handleKey('enter');
  else if (e.key === 'Backspace') handleKey('back');
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
});

// ===== SAVE ATTEMPT =====
async function saveAttempt(isSolved) {
  const target = getCurrentTarget();
  const durationMs = Date.now() - state.startTime;
  const durationSeconds = Math.floor(durationMs / 1000);
  const guessesCount = isSolved ? state.currentRow + 1 : MAX_GUESSES;
  
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    console.error('❌ No user session');
    return null;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabaseClient
    .from('attempts')
    .insert({
      user_id: user.id,
      play_date: today,
      slot: state.currentSlot,
      word_id: target.word_id,
      guesses_count: guessesCount,
      is_solved: isSolved,
      duration_seconds: durationSeconds,
    })
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') {
      console.warn(`⚠ Slot ${state.currentSlot} udah pernah ke-save sebelumnya.`);
      return null;
    }
    console.error('❌ Gagal save attempt:', error.message);
    return null;
  }
  
  console.log(`✅ Slot ${state.currentSlot} saved. Score: ${data.score}`);
  return data;
}

// ===== INIT =====
buildGrid();
buildKeyboard();

// ===== HOW TO PLAY MODAL =====
const howtoBtn = document.getElementById('howto-btn');
const howtoModal = document.getElementById('howto-modal');
const howtoCloseEl = document.getElementById('howto-close');
const howtoOkEl = document.getElementById('howto-ok');

function openHowto() {
  howtoModal.classList.remove('hidden');
}

function closeHowto() {
  howtoModal.classList.add('hidden');
  localStorage.setItem(HOWTO_SEEN_KEY, 'true');
}

if (howtoBtn) howtoBtn.addEventListener('click', openHowto);
if (howtoCloseEl) howtoCloseEl.addEventListener('click', closeHowto);
if (howtoOkEl) howtoOkEl.addEventListener('click', closeHowto);

// Auto-show untuk first-time visitor
if (!localStorage.getItem(HOWTO_SEEN_KEY)) {
  setTimeout(openHowto, 800);
}

// ===== HISTORY MODAL =====
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const historyCloseEl = document.getElementById('history-close');
const historySlotsEl = document.getElementById('history-slots');
const historyEmptyEl = document.getElementById('history-empty');

function buildHistorySlots() {
  historySlotsEl.innerHTML = '';
  let hasAnyHistory = false;
  
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const guesses = loadHistory(s);
    const hasHistory = guesses && guesses.length > 0;
    if (hasHistory) hasAnyHistory = true;
    
    const target = dailyWords.find(w => w.slot === s);
    const isSolved = hasHistory && target && guesses.includes(target.word);
    
    const btn = document.createElement('button');
    btn.className = 'history-slot-btn';
    btn.type = 'button';
    
    if (viewingSlot === s) btn.classList.add('active');
    if (!hasHistory) btn.disabled = true;
    
    let statusText = '–';
    if (hasHistory) {
      statusText = isSolved ? `${guesses.length}/6 ✓` : `${guesses.length}/6`;
    }
    
    btn.innerHTML = `${s}<span class="slot-status">${statusText}</span>`;
    btn.addEventListener('click', () => {
      if (!hasHistory) return;
      previewSlot(s);
      historyModal.classList.add('hidden');
    });
    
    historySlotsEl.appendChild(btn);
  }
  
  historyEmptyEl.classList.toggle('hidden', hasAnyHistory);
}

function openHistory() {
  buildHistorySlots();
  historyModal.classList.remove('hidden');
}

function closeHistory() {
  historyModal.classList.add('hidden');
}

if (historyBtn) historyBtn.addEventListener('click', openHistory);
if (historyCloseEl) historyCloseEl.addEventListener('click', closeHistory);

(async function init() {
  const [wordsLoaded, validLoaded] = await Promise.all([
    loadDailyWords(),
    loadValidWords()
  ]);
  if (!validLoaded) {
    console.warn('⚠ Valid words gagal load, validation mati');
  }
  if (!wordsLoaded) {
    showToast('gagal load game. cek console.');
    return;
  }
  
  const completedSlots = await loadUserProgress();
  
  // Load streak dan update badge
  loadStreak().then(streak => updateStreakBadge(streak));
  
  let nextSlot = 1;
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    if (!completedSlots.includes(s)) {
      nextSlot = s;
      break;
    }
    nextSlot = s + 1;
  }
  
  if (nextSlot > TOTAL_SLOTS) {
    state.isDayComplete = true;
    
    // Render history slot 5 (terakhir) ke grid
    const lastSlot = TOTAL_SLOTS;
    const lastGuesses = loadHistory(lastSlot);
    const lastTarget = dailyWords.find(w => w.slot === lastSlot);
    if (lastGuesses && lastTarget) {
      state.currentSlot = lastSlot;
      state.guesses = lastGuesses;
      state.currentRow = lastGuesses.length;
      state.isGameOver = true;
      renderHistoryToGrid(lastGuesses, lastTarget.word);
      console.log(`📜 Mode read-only: nampilkan slot ${lastSlot}`);
    }
    
    showDayCompleteModal();
    return;
  }
  
  state.currentSlot = nextSlot;
  console.log(`▶ Mulai dari slot ${nextSlot}`);
  
  // Load history slot ini kalau ada (resume di tengah)
  const savedGuesses = loadHistory(nextSlot);
  if (savedGuesses && savedGuesses.length > 0) {
    const target = getCurrentTarget();
    state.guesses = savedGuesses;
    state.currentRow = savedGuesses.length;
    renderHistoryToGrid(savedGuesses, target.word);
    console.log(`📜 Resume dari ${savedGuesses.length} tebakan tersimpan`);
  }
  
  if (nextSlot > 1) {
    showToast(`lanjut slot ${nextSlot} dari ${TOTAL_SLOTS}`);
  }
})();
/* =========================================
   SUPABASE CLIENT — Connection + Auth
========================================= */

const SUPABASE_URL = 'https://kyxoyqwqdoxqehswjgvs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eG95cXdxZG94cWVoc3dqZ3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTc1NjIsImV4cCI6MjA5MzA5MzU2Mn0.lgsmxiazUg_e3yvM3UX0psaFSGJ_Ci3tMvre7oNBsVk';

// PENTING: ganti SUPABASE_ANON_KEY di atas pakai key utuh yang lo punya
// (yang kepotong di sini cuma untuk display — full version udah ada di file lo sekarang)

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================================
   AUTH HELPERS
========================================= */

// Pastiin user punya session — kalau belum, sign in anonymous
async function ensureSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (session) {
    console.log('✅ Session aktif:', session.user.id.slice(0, 8) + '...');
    return session;
  }
  
  console.log('🔐 Bikin session anonymous...');
  const { data, error } = await supabaseClient.auth.signInAnonymously();
  
  if (error) {
    console.error('❌ Gagal bikin session:', error.message);
    return null;
  }
  
  console.log('✅ Anonymous session created:', data.user.id.slice(0, 8) + '...');
  return data.session;
}

// Ambil profile user yang lagi login (kalau ada)
async function getCurrentProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('❌ Gagal ambil profile:', error.message);
    return null;
  }
  return data;
}

// Init: panggil pas page load
ensureSession().then(async (session) => {
  if (!session) return;
  
  const profile = await getCurrentProfile();
  if (profile) {
    console.log(`👤 Player: ${profile.username}`);
  }
});
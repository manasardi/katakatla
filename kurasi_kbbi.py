import time
from kbbi import KBBI, TidakDitemukan, BatasSehari
from supabase import create_client

SUPABASE_URL = "https://kyxoyqwqdoxqehswjgvs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eG95cXdxZG94cWVoc3dqZ3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTc1NjIsImV4cCI6MjA5MzA5MzU2Mn0.lgsmxiazUg_e3yvM3UX0psaFSGJ_Ci3tMvre7oNBsVk"

DELAY = 1.5  # detik antar request, naikin kalau kena block
RESUME = True  # skip kata yang udah pernah di-kurasi

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Fetch kata dari Supabase...")
all_words = []
page = 0
while True:
    res = supabase.table("words").select("id, word, curation_status").range(page*1000, page*1000+999).execute()
    if not res.data:
        break
    all_words.extend(res.data)
    if len(res.data) < 1000:
        break
    page += 1

total = len(all_words)
print(f"Total: {total} kata")

if RESUME:
    pending = [w for w in all_words if not w.get('curation_status') or w['curation_status'] == 'pending']
    print(f"Skip {total - len(pending)} kata yang udah di-kurasi, sisa: {len(pending)}")
    all_words = pending

if not all_words:
    print("Semua kata udah di-kurasi! Exit.")
    exit()

print(f"\nEstimasi waktu: {len(all_words) * DELAY / 60:.0f} menit ({len(all_words) * DELAY / 3600:.1f} jam)")
confirm = input("Lanjut? (y/n): ")
if confirm.lower() != 'y':
    print("Dibatalin.")
    exit()

valid_count = 0
blacklist_count = 0
error_count = 0
start_time = time.time()

print("\nMulai kurasi...\n")

for i, w in enumerate(all_words):
    word = w['word']
    word_id = w['id']
    
    try:
        # Cek di KBBI resmi
        try:
            KBBI(word)
            # Kalau berhasil → kata ada di KBBI
            status = 'valid'
            valid_count += 1
            symbol = "✓"
        except TidakDitemukan:
            status = 'blacklist'
            blacklist_count += 1
            symbol = "✕"
        
        # Update Supabase
        supabase.table("words").update({"curation_status": status}).eq("id", word_id).execute()
        
        # Progress log tiap 10 kata
        if (i + 1) % 10 == 0 or i == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta_min = (len(all_words) - i - 1) / rate / 60 if rate > 0 else 0
            print(f"[{i+1}/{len(all_words)}] {symbol} {word} → {status} | ETA: {eta_min:.0f} menit | ✓{valid_count} ✕{blacklist_count}")
        
    except BatasSehari:
        print(f"\n⚠ KBBI minta jeda. Tunggu 60 detik...")
        time.sleep(60)
        # Retry kata yang sama
        try:
            KBBI(word)
            status = 'valid'
            valid_count += 1
        except TidakDitemukan:
            status = 'blacklist'
            blacklist_count += 1
        except:
            error_count += 1
            print(f"⚠ {word} → tetap error, skip")
            continue
        
        supabase.table("words").update({"curation_status": status}).eq("id", word_id).execute()
    
    except Exception as e:
        error_count += 1
        print(f"⚠ Error '{word}': {str(e)[:50]} → skip")
    
    time.sleep(DELAY)

elapsed_min = (time.time() - start_time) / 60
print(f"\n{'='*50}")
print(f"SELESAI dalam {elapsed_min:.0f} menit!")
print(f"✓ Valid: {valid_count}")
print(f"✕ Blacklist: {blacklist_count}")
print(f"⚠ Error: {error_count}")
print(f"{'='*50}")
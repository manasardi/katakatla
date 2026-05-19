import re
from supabase import create_client

SUPABASE_URL = "https://kyxoyqwqdoxqehswjgvs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eG95cXdxZG94cWVoc3dqZ3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTc1NjIsImV4cCI6MjA5MzA5MzU2Mn0.lgsmxiazUg_e3yvM3UX0psaFSGJ_Ci3tMvre7oNBsVk"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Baca kbbi_raw.txt
print("Baca kbbi_raw.txt...")
with open("kbbi_raw.txt", "r", encoding="utf-8") as f:
    raw = f.read()

# Parse: cari pasangan "kata" → "definisi"
# Format KBBI biasanya: kata\n  definisi atau kata: definisi
# Kita coba parsing fleksibel
definitions = {}

# Coba parse line-by-line dulu
lines = raw.split("\n")
current_word = None
current_def = []

for line in lines:
    line = line.strip()
    if not line:
        continue
    
    # Kalau cuma 5 huruf alfabet → kemungkinan headword
    if re.match(r'^[a-z]{5}$', line.lower()):
        if current_word and current_def:
            definitions[current_word] = " ".join(current_def).strip()
        current_word = line.lower()
        current_def = []
    else:
        if current_word:
            current_def.append(line)

if current_word and current_def:
    definitions[current_word] = " ".join(current_def).strip()

print(f"Parsed {len(definitions)} definisi dari kbbi_raw.txt")

# Sample check
sample = list(definitions.items())[:3]
for w, d in sample:
    print(f"  {w}: {d[:80]}...")

# Fetch semua kata di database
print("\nFetch kata dari Supabase...")
all_words = []
page = 0
while True:
    res = supabase.table("words").select("id, word").range(page*1000, page*1000+999).execute()
    if not res.data:
        break
    all_words.extend(res.data)
    if len(res.data) < 1000:
        break
    page += 1

print(f"Total kata di DB: {len(all_words)}")

# Match dan kumpulin update
matched = 0
unmatched = 0
to_update = []

for w in all_words:
    if w['word'] in definitions:
        defn = definitions[w['word']]
        # Limit panjang biar nggak kepanjangan
        if len(defn) > 300:
            defn = defn[:297] + "..."
        to_update.append({"id": w['id'], "definition": defn})
        matched += 1
    else:
        unmatched += 1

print(f"\nMatched: {matched} kata")
print(f"Unmatched: {unmatched} kata (definisinya bakal tetap NULL)")

if matched == 0:
    print("\n⚠ Tidak ada match. Format kbbi_raw.txt kemungkinan beda.")
    print("Kasih lihat 20 baris pertama kbbi_raw.txt biar bisa di-adjust parser-nya.")
    exit()

confirm = input("\nLanjut update database? (y/n): ")
if confirm.lower() != 'y':
    print("Dibatalin.")
    exit()

# Update batch
print("Updating...")
for i, item in enumerate(to_update):
    supabase.table("words").update({"definition": item["definition"]}).eq("id", item["id"]).execute()
    if (i+1) % 100 == 0:
        print(f"  {i+1}/{len(to_update)}")

print(f"\nDONE! {matched} definisi ter-update.")
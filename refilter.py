from wordfreq import zipf_frequency
from supabase import create_client

SUPABASE_URL = "https://kyxoyqwqdoxqehswjgvs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eG95cXdxZG94cWVoc3dqZ3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTc1NjIsImV4cCI6MjA5MzA5MzU2Mn0.lgsmxiazUg_e3yvM3UX0psaFSGJ_Ci3tMvre7oNBsVk"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Fetching words...")
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

print(f"Total: {len(all_words)} kata")

NEW_THRESHOLD = 4.0
common_ids = []
uncommon_ids = []

for w in all_words:
    score = zipf_frequency(w['word'], 'id')
    if score >= NEW_THRESHOLD:
        common_ids.append(w['id'])
    else:
        uncommon_ids.append(w['id'])

print(f"Common (>= {NEW_THRESHOLD}): {len(common_ids)} kata")
print(f"Uncommon: {len(uncommon_ids)} kata")

confirm = input("Lanjut update database? (y/n): ")
if confirm.lower() != 'y':
    print("Dibatalin.")
    exit()

BATCH = 500
for i in range(0, len(common_ids), BATCH):
    supabase.table("words").update({"is_common": True}).in_("id", common_ids[i:i+BATCH]).execute()
for i in range(0, len(uncommon_ids), BATCH):
    supabase.table("words").update({"is_common": False}).in_("id", uncommon_ids[i:i+BATCH]).execute()

print("DONE!")
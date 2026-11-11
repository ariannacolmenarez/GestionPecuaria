import urllib.request
import urllib.parse
import json
import sys

API_KEY = "AIzaSyDrNHJ17rUMqC5dhDkA40kw7jkImW7hVFE"
PROJECT_ID = "gestion-pecuaria-a99f8"
FARM_ID = "granja_arianna_principal"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def http_get(url):
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"GET error {e.code} for {url}: {e.read().decode('utf-8')}")
        return None

def http_delete(url):
    req = urllib.request.Request(url, method='DELETE')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"DELETE error {e.code} for {url}: {e.read().decode('utf-8')}")
        return None

def http_patch(url, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='PATCH', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"PATCH error {e.code} for {url}: {e.read().decode('utf-8')}")
        return None

def delete_collection(subcol_name):
    url = f"{BASE_URL}/farms/{FARM_ID}/{subcol_name}?pageSize=300&key={API_KEY}"
    res = http_get(url)
    if not res or 'documents' not in res:
        print(f"Collection {subcol_name}: empty")
        return 0
    docs = res['documents']
    print(f"Deleting {len(docs)} documents in {subcol_name}...")
    deleted = 0
    for doc in docs:
        doc_name = doc['name']
        del_url = f"https://firestore.googleapis.com/v1/{doc_name}?key={API_KEY}"
        http_delete(del_url)
        deleted += 1
    print(f"Finished {subcol_name}: {deleted} documents deleted.")
    return deleted

def reset_farm_summary():
    url = f"{BASE_URL}/farms/{FARM_ID}?key={API_KEY}"
    empty_doc = {
        "fields": {
            "name": {"stringValue": "Granja Arianna"},
            "location": {"stringValue": "Sector Pecuario Central"},
            "totalMembers": {"integerValue": "1"},
            "counts": {
                "mapValue": {
                    "fields": {
                        "porcino": {
                            "mapValue": {
                                "fields": {
                                    "productoras": {"integerValue": "0"},
                                    "lechones": {"integerValue": "0"},
                                    "verracos": {"integerValue": "0"},
                                    "engorde": {"integerValue": "0"}
                                }
                            }
                        },
                        "bovino": {
                            "mapValue": {
                                "fields": {
                                    "padrotes": {"integerValue": "0"},
                                    "vacas": {"integerValue": "0"},
                                    "becerros": {"integerValue": "0"}
                                }
                            }
                        },
                        "avicola": {
                            "mapValue": {
                                "fields": {
                                    "pollosEngorde": {"integerValue": "0"}
                                }
                            }
                        }
                    }
                }
            },
            "finances": {
                "mapValue": {
                    "fields": {
                        "period": {"stringValue": "Agosto 2026"},
                        "totalIncome": {"integerValue": "0"},
                        "totalExpenses": {"integerValue": "0"},
                        "netUtility": {"integerValue": "0"}
                    }
                }
            }
        }
    }
    http_patch(url, empty_doc)
    print("Farm summary document reset to 0.")

def main():
    collections = [
        'animals',
        'litters',
        'tasks',
        'movements',
        'warehouse',
        'sales',
        'bovino',
        'avicola',
        'feeding_plans',
        'batch_configs',
        'production_batches',
        'summary'
    ]
    total_del = 0
    for col in collections:
        total_del += delete_collection(col)
    
    reset_farm_summary()
    print(f"\nALL FIRESTORE COLLECTIONS PURGED. Total deleted: {total_del}")

if __name__ == '__main__':
    main()

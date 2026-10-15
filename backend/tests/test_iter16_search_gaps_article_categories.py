# Iteration 16: search tracking / search gaps, article categories, admin categories article_count
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
API = f"{BASE_URL}/api"
TOKEN = os.environ.get("HL_TOKEN") or open("/tmp/hl_token").read().strip()
H = {"Authorization": f"Bearer {TOKEN}"}
CREATED = {"articles": [], "categories": []}
UNIQ = f"TEST_cat_{int(time.time())}"


@pytest.fixture(scope="module", autouse=True)
def cleanup_after():
    yield
    for aid in CREATED["articles"]:
        requests.delete(f"{API}/admin/articles/{aid}", headers=H)
    for cid in CREATED["categories"]:
        requests.delete(f"{API}/admin/categories/{cid}", headers=H)
    db = MongoClient("mongodb://localhost:27017")["test_database"]
    db.campaigns.delete_many({"ref_id": {"$in": CREATED["articles"]}})
    db.searches.delete_many({"term_key": {"$regex": "^test_zz"}})


# --- Search tracking ---
class TestSearchTracking:
    def test_track_zero_result_term(self):
        r = requests.post(f"{API}/search/track", json={"q": "TEST_zzqqxx", "country": "Bahamas", "region": "", "results": 0})
        assert r.status_code == 200 and r.json()["ok"] is True
        r2 = requests.post(f"{API}/search/track", json={"q": "test_zzqqxx ", "results": 0})
        assert r2.json()["ok"] is True
        g = requests.get(f"{API}/admin/search-gaps", headers=H)
        assert g.status_code == 200
        d = g.json()
        assert isinstance(d["total_searches"], int) and isinstance(d["zero_result_searches"], int)
        row = next((t for t in d["terms"] if t["term"].lower() == "test_zzqqxx"), None)
        assert row is not None, "term grouped case-insensitively"
        assert row["count"] >= 2 and row["zero_results"] >= 2
        assert "Bahamas" in row["countries"]

    def test_track_short_term_ignored(self):
        before = requests.get(f"{API}/admin/search-gaps", headers=H).json()["total_searches"]
        r = requests.post(f"{API}/search/track", json={"q": "a", "results": 0})
        assert r.status_code == 200 and r.json()["ok"] is False
        r = requests.post(f"{API}/search/track", json={"q": "  b  ", "results": 0})
        assert r.json()["ok"] is False
        after = requests.get(f"{API}/admin/search-gaps", headers=H).json()["total_searches"]
        assert after == before

    def test_track_with_results(self):
        r = requests.post(f"{API}/search/track", json={"q": "TEST_zzwithres", "results": 5})
        assert r.json()["ok"] is True
        d = requests.get(f"{API}/admin/search-gaps", headers=H).json()
        row = next(t for t in d["terms"] if t["term"] == "TEST_zzwithres")
        assert row["zero_results"] == 0 and row["count"] >= 1

    def test_search_gaps_requires_admin(self):
        assert requests.get(f"{API}/admin/search-gaps").status_code in (401, 403)
        assert requests.delete(f"{API}/admin/search-gaps").status_code in (401, 403)

    def test_track_missing_q_validation(self):
        r = requests.post(f"{API}/search/track", json={"results": 0})
        assert r.status_code == 422


# --- Article categories ---
class TestArticleCategories:
    def test_categories_endpoint_shape(self):
        r = requests.get(f"{API}/articles/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for c in data:
            assert set(c.keys()) == {"name", "count"} and c["name"] and c["count"] >= 1
        assert any(c["name"] == "est" for c in data)

    def test_create_article_with_category_and_filter(self):
        payload = {"title": f"{UNIQ} article", "excerpt": "x", "content": "<p>x</p>", "category": UNIQ, "published": True}
        r = requests.post(f"{API}/admin/articles", json=payload, headers=H)
        assert r.status_code == 200
        art = r.json()
        CREATED["articles"].append(art["id"])
        assert art["category"] == UNIQ
        cats = requests.get(f"{API}/articles/categories").json()
        row = next((c for c in cats if c["name"] == UNIQ), None)
        assert row and row["count"] == 1
        lst = requests.get(f"{API}/articles", params={"category": UNIQ}).json()
        assert len(lst) == 1 and lst[0]["id"] == art["id"]
        est = requests.get(f"{API}/articles", params={"category": "est"}).json()
        assert all(a["category"] == "est" for a in est) and art["id"] not in [a["id"] for a in est]

    def test_unpublished_excluded_from_categories(self):
        name = UNIQ + "_draft"
        r = requests.post(f"{API}/admin/articles", json={"title": name, "category": name, "published": False}, headers=H)
        CREATED["articles"].append(r.json()["id"])
        cats = requests.get(f"{API}/articles/categories").json()
        assert not any(c["name"] == name for c in cats)

    def test_categories_country_filter(self):
        r = requests.get(f"{API}/articles/categories", params={"country": "ZZ_Nowhere"})
        assert r.status_code == 200 and r.json() == []


# --- Admin categories with article type ---
class TestAdminCategories:
    def test_create_article_type_category_counts(self):
        r = requests.post(f"{API}/admin/categories", json={"name": UNIQ, "type": "article", "icon": "", "description": ""}, headers=H)
        assert r.status_code == 200, r.text
        cat = r.json()
        CREATED["categories"].append(cat["id"])
        assert cat["type"] == "article"
        lst = requests.get(f"{API}/admin/categories", headers=H).json()
        row = next(c for c in lst if c["id"] == cat["id"])
        assert "article_count" in row and "provider_count" in row
        assert row["article_count"] >= 1  # article created in previous class uses this name

    def test_public_categories_type_filter(self):
        provider_cats = requests.get(f"{API}/categories", params={"type": "category"}).json()
        assert not any(c["name"] == UNIQ for c in provider_cats)

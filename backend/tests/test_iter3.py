"""Iteration 3 backend tests: provider lat/lng, rich-text article HTML persist, bulk lat/lng."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---- Provider lat/lng ----
def test_provider_create_with_coords(auth):
    payload = {
        "name": "TEST_ITER3_Coords",
        "island": "Barbados",
        "specialty": "Cardiology",
        "latitude": 13.19,
        "longitude": -59.54,
    }
    r = requests.post(f"{API}/admin/providers", headers=auth, json=payload)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["latitude"] == 13.19
    assert j["longitude"] == -59.54
    pid = j["id"]

    # public GET
    r2 = requests.get(f"{API}/providers/{pid}")
    assert r2.status_code == 200
    assert r2.json()["latitude"] == 13.19
    assert r2.json()["longitude"] == -59.54

    # update coords
    r3 = requests.put(f"{API}/admin/providers/{pid}", headers=auth,
                     json={**payload, "latitude": 14.0, "longitude": -60.0})
    assert r3.status_code == 200
    assert r3.json()["latitude"] == 14.0

    # cleanup
    requests.delete(f"{API}/admin/providers/{pid}", headers=auth)


def test_provider_create_null_coords(auth):
    payload = {"name": "TEST_ITER3_NoCoords", "island": "Jamaica"}
    r = requests.post(f"{API}/admin/providers", headers=auth, json=payload)
    assert r.status_code == 200
    j = r.json()
    assert j.get("latitude") is None
    assert j.get("longitude") is None
    requests.delete(f"{API}/admin/providers/{j['id']}", headers=auth)


# ---- Rich text article HTML ----
def test_article_stores_and_returns_html(auth):
    html = '<h2>Title Heading</h2><p>Body text with <strong>bold word</strong>.</p><ul><li>one</li><li>two</li></ul>'
    payload = {
        "title": "TEST_ITER3_RichArticle",
        "slug": "test-iter3-rich",
        "excerpt": "e",
        "content": html,
        "author": "T",
        "category": "Cat",
        "island": "Barbados",
    }
    r = requests.post(f"{API}/admin/articles", headers=auth, json=payload)
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    slug = r.json()["slug"]
    assert r.json()["content"] == html

    r2 = requests.get(f"{API}/articles/{slug}")
    assert r2.status_code == 200
    assert "<strong>bold word</strong>" in r2.json()["content"]
    assert "<h2>" in r2.json()["content"]

    requests.delete(f"{API}/admin/articles/{aid}", headers=auth)


# ---- Bulk CSV with lat/lng ----
def test_bulk_import_with_coords(auth):
    csv = (
        "name,island,latitude,longitude\n"
        "TEST_ITER3_BULK,Barbados,13.1,-59.6\n"
    )
    r = requests.post(f"{API}/admin/providers/bulk", headers=auth,
                      files={"file": ("p.csv", csv.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 1

    r = requests.get(f"{API}/providers", params={"q": "TEST_ITER3_BULK"})
    row = next(p for p in r.json() if p["name"] == "TEST_ITER3_BULK")
    assert row["latitude"] == 13.1
    assert row["longitude"] == -59.6
    requests.delete(f"{API}/admin/providers/{row['id']}", headers=auth)


# ---- Island scoping on public endpoints (light regression) ----
def test_providers_island_filter():
    r = requests.get(f"{API}/providers", params={"island": "Barbados"})
    assert r.status_code == 200
    for p in r.json():
        assert p["island"] == "Barbados"


def test_articles_island_filter_supported():
    r = requests.get(f"{API}/articles", params={"island": "Barbados"})
    assert r.status_code == 200
    # if any results, all must match
    for a in r.json():
        assert a.get("island") in ("Barbados", None) or a["island"] == "Barbados"


def test_demo_providers_have_coords():
    r = requests.get(f"{API}/providers")
    assert r.status_code == 200
    names = {p["name"]: p for p in r.json()}
    ayana = names.get("Dr. Ayana Clarke")
    sunrise = names.get("Sunrise Cardiology")
    assert ayana is not None, "Demo provider Dr. Ayana Clarke missing"
    assert sunrise is not None, "Demo provider Sunrise Cardiology missing"
    assert ayana.get("latitude") is not None and ayana.get("longitude") is not None
    assert sunrise.get("latitude") is not None and sunrise.get("longitude") is not None

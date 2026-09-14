"""Backend integration tests for My Healthcare Link."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://provider-finder-19.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"

s = requests.Session()


@pytest.fixture(scope="module")
def token():
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Meta ----------------
def test_root():
    r = s.get(f"{API}/")
    assert r.status_code == 200


def test_islands():
    r = s.get(f"{API}/islands")
    assert r.status_code == 200
    assert "Barbados" in r.json()


def test_stats():
    r = s.get(f"{API}/stats")
    assert r.status_code == 200
    assert "providers" in r.json()


# ---------------- Auth ----------------
def test_login_bad_password():
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth():
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_with_token(auth):
    r = s.get(f"{API}/auth/me", headers=auth)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_admin_protected():
    r = s.get(f"{API}/admin/providers")
    assert r.status_code == 401


# ---------------- Provider CRUD ----------------
def test_provider_full_crud(auth):
    payload = {
        "name": "TEST_Provider_Clinic",
        "specialty": "Cardiology",
        "category": "Clinic",
        "niches": ["Heart"],
        "description": "Test clinic",
        "phone": "1234",
        "email": "t@t.com",
        "island": "Barbados",
        "services": ["Consult"],
        "in_network": True,
        "verified": True,
        "featured": True,
    }
    r = s.post(f"{API}/admin/providers", json=payload, headers=auth)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    assert r.json()["name"] == "TEST_Provider_Clinic"

    # GET public
    r = s.get(f"{API}/providers/{pid}")
    assert r.status_code == 200
    assert r.json()["island"] == "Barbados"

    # filters
    r = s.get(f"{API}/providers", params={"q": "TEST_Provider", "island": "Barbados", "in_network": "true", "featured": "true"})
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    # Update
    upd = dict(payload)
    upd["name"] = "TEST_Provider_Updated"
    r = s.put(f"{API}/admin/providers/{pid}", json=upd, headers=auth)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Provider_Updated"

    # Review submission (pending)
    r = s.post(f"{API}/reviews", json={
        "provider_id": pid, "author_name": "Tester", "rating": 5,
        "comment": "Great", "island": "Barbados"
    })
    assert r.status_code == 200
    # public /reviews should not include pending
    r = s.get(f"{API}/reviews", params={"provider_id": pid})
    assert r.status_code == 200
    assert len(r.json()) == 0

    # admin list pending
    r = s.get(f"{API}/admin/reviews", params={"status": "pending"}, headers=auth)
    assert r.status_code == 200
    pending = [x for x in r.json() if x["provider_id"] == pid]
    assert pending
    rid = pending[0]["id"]

    # approve
    r = s.put(f"{API}/admin/reviews/{rid}/status", params={"status": "approved"}, headers=auth)
    assert r.status_code == 200

    # public visible
    r = s.get(f"{API}/reviews", params={"provider_id": pid})
    assert len(r.json()) == 1

    # provider rating updated
    r = s.get(f"{API}/providers/{pid}")
    assert r.json()["rating"] == 5.0
    assert r.json()["review_count"] == 1

    # sort by rating
    r = s.get(f"{API}/providers", params={"sort": "rating"})
    assert r.status_code == 200

    # delete review
    r = s.delete(f"{API}/admin/reviews/{rid}", headers=auth)
    assert r.status_code == 200

    # Delete provider (cleanup)
    r = s.delete(f"{API}/admin/providers/{pid}", headers=auth)
    assert r.status_code == 200
    r = s.get(f"{API}/providers/{pid}")
    assert r.status_code == 404


# ---------------- Category ----------------
def test_category_crud(auth):
    for t in ("category", "specialty"):
        r = s.post(f"{API}/admin/categories", json={"name": f"TEST_{t}", "type": t}, headers=auth)
        assert r.status_code == 200
        cid = r.json()["id"]
        r = s.get(f"{API}/categories", params={"type": t})
        assert any(c["id"] == cid for c in r.json())
        r = s.delete(f"{API}/admin/categories/{cid}", headers=auth)
        assert r.status_code == 200


# ---------------- Service ----------------
def test_service_crud(auth):
    r = s.post(f"{API}/admin/services", json={"name": "TEST_Service", "island": "Jamaica"}, headers=auth)
    assert r.status_code == 200
    sid = r.json()["id"]
    r = s.get(f"{API}/services", params={"island": "Jamaica"})
    assert any(x["id"] == sid for x in r.json())
    r = s.delete(f"{API}/admin/services/{sid}", headers=auth)
    assert r.status_code == 200


# ---------------- Article ----------------
def test_article_crud(auth):
    r = s.post(f"{API}/admin/articles", json={"title": "TEST_Article Hello", "excerpt": "e", "content": "c", "island": "Jamaica"}, headers=auth)
    assert r.status_code == 200
    aid = r.json()["id"]
    slug = r.json()["slug"]
    r = s.get(f"{API}/articles/{slug}")
    assert r.status_code == 200
    r = s.get(f"{API}/articles", params={"island": "Jamaica"})
    assert any(x["id"] == aid for x in r.json())
    r = s.delete(f"{API}/admin/articles/{aid}", headers=auth)
    assert r.status_code == 200


# ---------------- Event ----------------
def test_event_crud(auth):
    r = s.post(f"{API}/admin/events", json={"name": "TEST_Event", "date": "2026-06-01", "island": "Barbados"}, headers=auth)
    assert r.status_code == 200
    eid = r.json()["id"]
    r = s.get(f"{API}/events/{eid}")
    assert r.status_code == 200
    r = s.get(f"{API}/events", params={"island": "Barbados"})
    assert any(x["id"] == eid for x in r.json())
    r = s.delete(f"{API}/admin/events/{eid}", headers=auth)
    assert r.status_code == 200

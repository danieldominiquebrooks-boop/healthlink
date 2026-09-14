"""Iteration 6 tests: PWA sw.js/manifest/icons still served; providers CRUD works incl. address-only (no coords).
Also basic regression on login + reviews approve.
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-finder-19.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PWD = "HealthLink@2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


# --- PWA static assets ---
def test_sw_served():
    r = requests.get(f"{BASE}/sw.js")
    assert r.status_code == 200, r.text
    assert "hl-cache-v2" in r.text
    assert "fetch" in r.text


def test_manifest_served():
    r = requests.get(f"{BASE}/manifest.json")
    assert r.status_code == 200
    j = r.json()
    assert "icons" in j and len(j["icons"]) >= 1


@pytest.mark.parametrize("path", ["/icon-192.png", "/icon-512.png", "/favicon.png"])
def test_icons_served(path):
    r = requests.get(f"{BASE}{path}")
    assert r.status_code == 200


# --- Auth regression ---
def test_admin_login_works(token):
    assert isinstance(token, str) and len(token) > 20


# --- Provider CRUD (address-only, no coords) for directions fallback ---
def test_create_provider_address_only(h):
    payload = {
        "name": "TEST_ITER6_AddrOnly",
        "specialty": "General",
        "island": "Barbados",
        "address": "Broad Street, Bridgetown",
        "phone": "+1 246 000 0000",
        "email": "t@e.com",
        "description": "address-only fallback",
        "categories": [],
        "services": [],
        "featured": False,
        # NO latitude/longitude
    }
    r = requests.post(f"{API}/admin/providers", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    pid = p["id"]
    # ensure coords absent or null
    assert not p.get("latitude") or p.get("latitude") in (None, "", 0)
    # cleanup
    d = requests.delete(f"{API}/admin/providers/{pid}", headers=h)
    assert d.status_code in (200, 204)


def test_create_provider_with_coords(h):
    payload = {
        "name": "TEST_ITER6_Coords",
        "specialty": "General",
        "island": "Barbados",
        "address": "Somewhere",
        "phone": "+1 246 000 0001",
        "email": "t2@e.com",
        "description": "coords",
        "categories": [],
        "services": [],
        "featured": False,
        "latitude": 13.19,
        "longitude": -59.54,
    }
    r = requests.post(f"{API}/admin/providers", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    assert float(p["latitude"]) == 13.19
    assert float(p["longitude"]) == -59.54
    requests.delete(f"{API}/admin/providers/{p['id']}", headers=h)


def test_reviews_endpoint_public():
    r = requests.get(f"{API}/reviews")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

"""Map accuracy bug-fix verification tests.

Creates TEST_MAP_* providers with:
  A) exact coords in Barbados,
  B) exact coords in Kingston Jamaica,
  C) no coordinates,
  D) invalid (out-of-range) coordinates.
Then verifies GET /api/providers returns them and cleans up.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_providers(auth_headers):
    """Create test providers and cleanup at end."""
    providers = [
        {"name": "TEST_MAP_A_Barbados", "country": "Barbados", "region": "Bridgetown",
         "address": "Bridgetown, Barbados", "specialty": "Cardiology",
         "latitude": 13.0975, "longitude": -59.6167, "active": True},
        {"name": "TEST_MAP_B_Kingston", "country": "Jamaica", "region": "Kingston",
         "address": "Kingston, Jamaica", "specialty": "Pediatrics",
         "latitude": 18.0179, "longitude": -76.8099, "active": True},
        {"name": "TEST_MAP_C_NoCoords", "country": "Barbados", "region": "Bridgetown",
         "address": "Somewhere, Barbados", "specialty": "Dentistry",
         "latitude": None, "longitude": None, "active": True},
        {"name": "TEST_MAP_D_Invalid", "country": "Barbados", "region": "Bridgetown",
         "address": "Bad coords", "specialty": "Dermatology",
         "latitude": 999.0, "longitude": -999.0, "active": True},
    ]
    ids = []
    for body in providers:
        r = requests.post(f"{BASE_URL}/api/admin/providers", json=body, headers=auth_headers, timeout=30)
        assert r.status_code in (200, 201), f"create failed {r.status_code} {r.text}"
        ids.append(r.json()["id"])
    yield ids
    for pid in ids:
        requests.delete(f"{BASE_URL}/api/admin/providers/{pid}", headers=auth_headers, timeout=30)


def test_login_ok(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 10


def test_created_providers_have_expected_coords(created_providers, auth_headers):
    # Fetch each via public GET and check lat/lng persistence.
    ids = created_providers
    a = requests.get(f"{BASE_URL}/api/providers/{ids[0]}", timeout=30).json()
    b = requests.get(f"{BASE_URL}/api/providers/{ids[1]}", timeout=30).json()
    c = requests.get(f"{BASE_URL}/api/providers/{ids[2]}", timeout=30).json()
    d = requests.get(f"{BASE_URL}/api/providers/{ids[3]}", timeout=30).json()

    assert a["name"] == "TEST_MAP_A_Barbados"
    assert abs(a["latitude"] - 13.0975) < 1e-4
    assert abs(a["longitude"] - -59.6167) < 1e-4

    assert b["name"] == "TEST_MAP_B_Kingston"
    assert abs(b["latitude"] - 18.0179) < 1e-4
    assert abs(b["longitude"] - -76.8099) < 1e-4

    # C: no coords
    assert c["latitude"] in (None, 0) or c["latitude"] is None
    assert c["longitude"] in (None, 0) or c["longitude"] is None

    # D: invalid range persists as-is (frontend must filter). Accept any float.
    assert d["latitude"] == 999.0 and d["longitude"] == -999.0


def test_providers_listed_in_public_directory(created_providers):
    r = requests.get(f"{BASE_URL}/api/providers?limit=500", timeout=30)
    assert r.status_code == 200
    names = {p["name"] for p in r.json()}
    for want in ("TEST_MAP_A_Barbados", "TEST_MAP_B_Kingston",
                 "TEST_MAP_C_NoCoords", "TEST_MAP_D_Invalid"):
        assert want in names, f"missing {want}"


def test_update_latitude_persists(created_providers, auth_headers):
    pid = created_providers[0]
    body = {
        "name": "TEST_MAP_A_Barbados", "specialty": "Cardiology",
        "category": "", "niches": [], "description": "", "phone": "",
        "email": "", "website": "", "address": "Bridgetown, Barbados",
        "country": "Barbados", "region": "Bridgetown", "image_url": "",
        "latitude": 13.1000, "longitude": -59.6200, "hours": None,
        "services": [], "in_network": False, "accepting_new_patients": True,
        "verified": False, "featured": False, "active": True,
    }
    r = requests.put(f"{BASE_URL}/api/admin/providers/{pid}", json=body, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    got = requests.get(f"{BASE_URL}/api/providers/{pid}", timeout=30).json()
    assert abs(got["latitude"] - 13.1000) < 1e-4
    assert abs(got["longitude"] - -59.6200) < 1e-4

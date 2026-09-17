"""Iteration 11: Auto-geocoding, /admin/geocode lookup, and bulk backfill endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------- Single geocode lookup ----------
def test_geocode_lookup_valid(auth):
    r = requests.get(f"{API}/admin/geocode", params={"q": "Bridgetown, Barbados"},
                     headers=auth, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "latitude" in d and "longitude" in d
    assert 12.9 <= d["latitude"] <= 13.3
    assert -59.9 <= d["longitude"] <= -59.4


def test_geocode_lookup_requires_auth():
    r = requests.get(f"{API}/admin/geocode", params={"q": "Bridgetown"}, timeout=15)
    assert r.status_code in (401, 403)


def test_geocode_lookup_unresolvable(auth):
    r = requests.get(f"{API}/admin/geocode",
                     params={"q": "zzqqxxvvbbnnmm_no_such_place_12345"},
                     headers=auth, timeout=20)
    assert r.status_code == 404


# ---------- Auto-geocode on create ----------
def test_auto_geocode_on_create_barbados(auth):
    r = requests.post(f"{API}/admin/providers", headers=auth,
                      json={"name": "TEST_GEO_Bridgetown",
                            "address": "Bridgetown",
                            "country": "Barbados"}, timeout=25)
    assert r.status_code == 200, r.text
    p = r.json()
    try:
        assert p.get("latitude") is not None, "latitude was not populated by geocoder"
        assert p.get("longitude") is not None
        assert 12.9 <= p["latitude"] <= 13.3, p
        assert -59.9 <= p["longitude"] <= -59.4, p
        # persisted?
        g = requests.get(f"{API}/providers/{p['id']}", timeout=15).json()
        assert g["latitude"] == p["latitude"]
    finally:
        requests.delete(f"{API}/admin/providers/{p['id']}", headers=auth, timeout=15)


def test_auto_geocode_on_create_kingston(auth):
    r = requests.post(f"{API}/admin/providers", headers=auth,
                      json={"name": "TEST_GEO_Kingston",
                            "address": "Kingston",
                            "country": "Jamaica"}, timeout=25)
    assert r.status_code == 200, r.text
    p = r.json()
    try:
        assert p.get("latitude") is not None
        assert 17.8 <= p["latitude"] <= 18.2, p
        assert -76.95 <= p["longitude"] <= -76.65, p
    finally:
        requests.delete(f"{API}/admin/providers/{p['id']}", headers=auth, timeout=15)


def test_explicit_coords_preserved(auth):
    r = requests.post(f"{API}/admin/providers", headers=auth,
                      json={"name": "TEST_GEO_Explicit",
                            "address": "Bridgetown",
                            "country": "Barbados",
                            "latitude": 1.2345,
                            "longitude": 6.7890}, timeout=25)
    assert r.status_code == 200, r.text
    p = r.json()
    try:
        assert p["latitude"] == 1.2345
        assert p["longitude"] == 6.7890
    finally:
        requests.delete(f"{API}/admin/providers/{p['id']}", headers=auth, timeout=15)


def test_update_auto_geocodes_when_missing_coords(auth):
    # create with coords
    r = requests.post(f"{API}/admin/providers", headers=auth,
                      json={"name": "TEST_GEO_Update",
                            "address": "somewhere",
                            "country": "Barbados",
                            "latitude": 10.0, "longitude": 20.0}, timeout=25)
    p = r.json()
    pid = p["id"]
    try:
        # update without coords -> should re-geocode from address
        r2 = requests.put(f"{API}/admin/providers/{pid}", headers=auth,
                          json={"name": "TEST_GEO_Update",
                                "address": "Kingston",
                                "country": "Jamaica"}, timeout=25)
        assert r2.status_code == 200, r2.text
        p2 = r2.json()
        assert p2.get("latitude") is not None
        assert 17.8 <= p2["latitude"] <= 18.2
    finally:
        requests.delete(f"{API}/admin/providers/{pid}", headers=auth, timeout=15)


# ---------- Bulk backfill ----------
def test_bulk_backfill_shape(auth):
    r = requests.post(f"{API}/admin/providers/geocode", headers=auth, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "updated" in d and "remaining" in d
    assert isinstance(d["updated"], int) and d["updated"] >= 0
    assert isinstance(d["remaining"], int) and d["remaining"] >= 0


def test_bulk_backfill_requires_auth():
    r = requests.post(f"{API}/admin/providers/geocode", timeout=15)
    assert r.status_code in (401, 403)


# ---------- Regression ----------
def test_provider_crud_regression(auth):
    r = requests.post(f"{API}/admin/providers", headers=auth,
                      json={"name": "TEST_GEO_CRUD", "country": "Barbados"}, timeout=15)
    assert r.status_code == 200
    p = r.json()
    pid = p["id"]
    try:
        # get public
        g = requests.get(f"{API}/providers/{pid}", timeout=15)
        assert g.status_code == 200
        # list
        lst = requests.get(f"{API}/providers", params={"q": "TEST_GEO_CRUD"}, timeout=15)
        assert lst.status_code == 200
        assert any(x["id"] == pid for x in lst.json())
        # update
        u = requests.put(f"{API}/admin/providers/{pid}", headers=auth,
                        json={"name": "TEST_GEO_CRUD2", "country": "Barbados",
                              "latitude": 13.1, "longitude": -59.6}, timeout=15)
        assert u.status_code == 200
        assert u.json()["name"] == "TEST_GEO_CRUD2"
    finally:
        d = requests.delete(f"{API}/admin/providers/{pid}", headers=auth, timeout=15)
        assert d.status_code == 200


def test_categories_still_work():
    r = requests.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_bulk_delete_regression(auth):
    ids = []
    for name in ("TEST_GEO_BULK_A", "TEST_GEO_BULK_B"):
        r = requests.post(f"{API}/admin/providers", headers=auth,
                          json={"name": name, "country": "Barbados",
                                "latitude": 13.1, "longitude": -59.6}, timeout=15)
        ids.append(r.json()["id"])
    r = requests.post(f"{API}/admin/providers/bulk-delete", headers=auth,
                      json={"ids": ids}, timeout=15)
    assert r.status_code == 200
    assert r.json()["deleted"] == 2

"""Iteration 9 tests: admin list categories & provider bulk-delete."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_admin_list_categories(h):
    r = requests.get(f"{BASE_URL}/api/admin/categories", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # sorted by name
    names = [c["name"] for c in data]
    assert names == sorted(names, key=str.lower) or names == sorted(names)
    # no _id leaked
    for c in data:
        assert "_id" not in c
        assert "name" in c and "type" in c


def test_bulk_delete_empty(h):
    r = requests.post(f"{BASE_URL}/api/admin/providers/bulk-delete",
                      headers=h, json={"ids": []})
    assert r.status_code == 200
    assert r.json() == {"deleted": 0}


def test_bulk_delete_blanks_ignored(h):
    r = requests.post(f"{BASE_URL}/api/admin/providers/bulk-delete",
                      headers=h, json={"ids": ["", None] if False else ["", "   "]})
    # blank strings: "" filtered by `if i`; "   " is truthy -> results in 0 match
    assert r.status_code == 200
    assert r.json()["deleted"] == 0


def _create_provider(h, name):
    payload = {
        "name": name,
        "specialty": "TestSpec",
        "category_id": None,
        "country": "USA",
        "region": "CA",
        "city": "TestCity",
        "address": "1 Test",
        "phone": "555",
        "email": f"{name}@t.com",
        "website": "",
        "bio": "",
        "photo_url": "",
    }
    r = requests.post(f"{BASE_URL}/api/admin/providers", headers=h, json=payload)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    return r.json()["id"]


def test_bulk_delete_flow(h):
    a = _create_provider(h, "TEST_ITER9_A")
    b = _create_provider(h, "TEST_ITER9_B")
    c = _create_provider(h, "TEST_ITER9_C")

    # Bulk delete A + B
    r = requests.post(f"{BASE_URL}/api/admin/providers/bulk-delete",
                      headers=h, json={"ids": [a, b]})
    assert r.status_code == 200
    assert r.json() == {"deleted": 2}

    # Verify: A and B gone, C remains
    for pid, should_exist in [(a, False), (b, False), (c, True)]:
        rr = requests.get(f"{BASE_URL}/api/providers/{pid}")
        if should_exist:
            assert rr.status_code == 200, f"C should exist, got {rr.status_code}"
        else:
            assert rr.status_code == 404, f"{pid} should be gone, got {rr.status_code}"

    # Cleanup C via single delete
    rr = requests.delete(f"{BASE_URL}/api/admin/providers/{c}", headers=h)
    assert rr.status_code == 200
    rr = requests.get(f"{BASE_URL}/api/providers/{c}")
    assert rr.status_code == 404


def test_bulk_delete_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/providers/bulk-delete",
                      json={"ids": ["x"]})
    assert r.status_code in (401, 403)


def test_admin_categories_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/categories")
    assert r.status_code in (401, 403)

"""Iteration 4 tests: featured toggle via PUT, upload endpoint, article inline image persistence, provider basics"""
import os
import io
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


def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200


def test_public_providers_list():
    r = requests.get(f"{API}/providers")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_providers_list(h):
    r = requests.get(f"{API}/admin/providers", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_feature_toggle_via_full_put(h):
    # Grab any provider; prefer Dr. Ayana Clarke
    r = requests.get(f"{API}/admin/providers", headers=h)
    providers = r.json()
    assert providers
    target = next((p for p in providers if "Ayana" in p.get("name", "")), providers[0])
    pid = target["id"]
    original = bool(target.get("featured"))

    # Send whole provider object with extra fields (rating/review_count/id) — backend should ignore extras
    payload = dict(target)
    payload["featured"] = not original
    # add extras that PUT should ignore
    payload["rating"] = 4.7
    payload["review_count"] = 12

    r = requests.put(f"{API}/admin/providers/{pid}", json=payload, headers=h)
    assert r.status_code == 200, r.text
    assert r.json().get("featured") == (not original)

    # verify persistence
    r2 = requests.get(f"{API}/providers/{pid}")
    assert r2.status_code == 200
    assert bool(r2.json().get("featured")) == (not original)

    # Toggle back to original
    payload["featured"] = original
    r3 = requests.put(f"{API}/admin/providers/{pid}", json=payload, headers=h)
    assert r3.status_code == 200
    assert bool(r3.json().get("featured")) == original


def test_upload_endpoint(h):
    # 1x1 PNG
    png = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082"
    )
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{API}/admin/upload", files=files, headers=h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data
    # confirm accessible
    r2 = requests.get(f"{BASE}{data['url']}")
    assert r2.status_code == 200


def test_article_with_inline_image_roundtrip(h):
    # Upload image first
    png = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082"
    )
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    up = requests.post(f"{API}/admin/upload", files=files, headers=h)
    assert up.status_code == 200
    img_url = up.json()["url"]

    body = f'<p>Intro para</p><p><img src="{BASE}{img_url}" alt="inline"/></p><p>Outro</p>'
    payload = {
        "title": "TEST_ITER4_InlineImage",
        "excerpt": "test",
        "content": body,
        "author": "Tester",
        "category": "Wellness",
        "published": True,
        "tags": [],
    }
    r = requests.post(f"{API}/admin/articles", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    art = r.json()
    slug = art.get("slug")
    aid = art.get("id")
    assert slug

    # Fetch by slug (public)
    r2 = requests.get(f"{API}/articles/{slug}")
    assert r2.status_code == 200
    assert "<img" in r2.json().get("content", "")

    # cleanup
    if aid:
        requests.delete(f"{API}/admin/articles/{aid}", headers=h)


def test_provider_create_update_delete(h):
    payload = {
        "name": "TEST_ITER4_Provider",
        "specialty": "General",
        "island": "Barbados",
        "phone": "+1 246 000 0000",
        "email": "t@e.com",
        "address": "x",
        "description": "y",
        "categories": [],
        "services": [],
        "featured": False,
        "latitude": 13.1,
        "longitude": -59.6,
    }
    r = requests.post(f"{API}/admin/providers", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]

    # update
    upd = dict(payload)
    upd["description"] = "updated"
    r2 = requests.put(f"{API}/admin/providers/{pid}", json=upd, headers=h)
    assert r2.status_code == 200
    assert r2.json()["description"] == "updated"

    # delete
    r3 = requests.delete(f"{API}/admin/providers/{pid}", headers=h)
    assert r3.status_code in (200, 204)

    r4 = requests.get(f"{API}/providers/{pid}")
    assert r4.status_code == 404

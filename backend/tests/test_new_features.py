"""Tests for iteration 2 features: photo upload, bulk CSV, saved (backend endpoints)."""
import io
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-finder-19.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"

# 1x1 PNG
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ------------- Upload -------------
def test_upload_requires_auth():
    r = requests.post(f"{API}/admin/upload", files={"file": ("t.png", PNG_1X1, "image/png")})
    assert r.status_code == 401


def test_upload_rejects_non_image(auth):
    r = requests.post(f"{API}/admin/upload", headers=auth,
                      files={"file": ("t.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_upload_and_serve(auth):
    r = requests.post(f"{API}/admin/upload", headers=auth,
                      files={"file": ("test.png", PNG_1X1, "image/png")})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "path" in data and "url" in data
    assert data["url"].startswith("/api/files/")

    # Serve back
    r2 = requests.get(f"{BASE_URL}{data['url']}")
    assert r2.status_code == 200
    assert r2.headers["content-type"].startswith("image/")
    assert len(r2.content) > 0


def test_upload_used_in_provider(auth):
    r = requests.post(f"{API}/admin/upload", headers=auth,
                      files={"file": ("test.png", PNG_1X1, "image/png")})
    assert r.status_code == 200
    url_path = r.json()["url"]
    full_url = f"{BASE_URL}{url_path}"

    # Create provider with the uploaded image
    r = requests.post(f"{API}/admin/providers", headers=auth, json={
        "name": "TEST_UPLOAD_Provider", "island": "Barbados", "image_url": full_url,
    })
    assert r.status_code == 200
    pid = r.json()["id"]
    assert r.json()["image_url"] == full_url

    # GET public
    r = requests.get(f"{API}/providers/{pid}")
    assert r.status_code == 200
    assert r.json()["image_url"] == full_url

    # cleanup
    requests.delete(f"{API}/admin/providers/{pid}", headers=auth)


# ------------- Bulk CSV -------------
def test_bulk_import_requires_auth():
    r = requests.post(f"{API}/admin/providers/bulk",
                      files={"file": ("t.csv", b"name\nX", "text/csv")})
    assert r.status_code == 401


def test_bulk_import_two_rows(auth):
    csv_body = (
        "name,specialty,category,island,description,phone,email,niches,services,in_network,featured,verified,accepting_new_patients\n"
        "TEST_BULK_A,Cardiology,Clinic,Barbados,Desc A,111,a@a.com,Heart;Vascular,Consult|Echo,true,false,true,true\n"
        "TEST_BULK_B,Pediatrics,Clinic,Jamaica,Desc B,222,b@b.com,Kids,Checkup,false,true,false,true\n"
    )
    r = requests.post(f"{API}/admin/providers/bulk", headers=auth,
                      files={"file": ("providers.csv", csv_body.encode("utf-8"), "text/csv")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 2, body

    # Fetch and verify
    r = requests.get(f"{API}/providers", params={"q": "TEST_BULK"})
    items = r.json()
    a = next((p for p in items if p["name"] == "TEST_BULK_A"), None)
    b = next((p for p in items if p["name"] == "TEST_BULK_B"), None)
    assert a and b
    assert a["island"] == "Barbados"
    assert a["in_network"] is True
    assert a["verified"] is True
    assert "Heart" in a["niches"] and "Vascular" in a["niches"]
    assert "Echo" in a["services"]
    assert b["featured"] is True
    assert b["in_network"] is False

    # cleanup
    for p in (a, b):
        requests.delete(f"{API}/admin/providers/{p['id']}", headers=auth)


def test_bulk_import_skips_missing_name(auth):
    csv_body = "name,island\n,Barbados\nTEST_BULK_C,Jamaica\n"
    r = requests.post(f"{API}/admin/providers/bulk", headers=auth,
                      files={"file": ("p.csv", csv_body.encode("utf-8"), "text/csv")})
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 1
    assert len(body["errors"]) == 1

    r = requests.get(f"{API}/providers", params={"q": "TEST_BULK_C"})
    for p in r.json():
        if p["name"] == "TEST_BULK_C":
            requests.delete(f"{API}/admin/providers/{p['id']}", headers=auth)

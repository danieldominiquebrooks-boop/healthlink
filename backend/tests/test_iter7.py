"""Iteration 7 tests: provider hours persistence, article featured sort, favicon assets."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PWD = "HealthLink@2026!"


@pytest.fixture(scope="module")
def h():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --- Favicon / app icons ---
@pytest.mark.parametrize("path", ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"])
def test_icons_200(path):
    r = requests.get(f"{BASE}{path}")
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    assert int(r.headers.get("content-length", "1")) > 0 or r.content


def test_index_html_references_icons():
    r = requests.get(f"{BASE}/")
    assert r.status_code == 200
    html = r.text.lower()
    assert "favicon.ico" in html
    assert "apple-touch-icon" in html


def test_manifest_lists_icons():
    r = requests.get(f"{BASE}/manifest.json")
    assert r.status_code == 200
    j = r.json()
    srcs = " ".join([i.get("src", "") for i in j.get("icons", [])])
    assert "icon-192" in srcs
    assert "icon-512" in srcs


# --- Provider hours persistence ---
def test_provider_hours_persist(h):
    hours = {
        "mon": {"open": "08:00", "close": "20:00", "closed": False},
        "tue": {"open": "09:00", "close": "17:00", "closed": False},
        "wed": {"open": "09:00", "close": "17:00", "closed": False},
        "thu": {"open": "09:00", "close": "17:00", "closed": False},
        "fri": {"open": "09:00", "close": "17:00", "closed": False},
        "sat": {"open": "10:00", "close": "14:00", "closed": False},
        "sun": {"open": "", "close": "", "closed": True},
    }
    payload = {
        "name": "TEST_ITER7_Hours",
        "specialty": "General",
        "island": "Barbados",
        "address": "Test Address",
        "phone": "+1 246 000 0007",
        "email": "h@e.com",
        "description": "hours test",
        "hours": hours,
    }
    r = requests.post(f"{API}/admin/providers", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    try:
        # GET back
        g = requests.get(f"{API}/providers/{pid}")
        assert g.status_code == 200
        got = g.json().get("hours")
        assert got is not None, "hours missing from GET response"
        assert got["mon"]["open"] == "08:00"
        assert got["mon"]["close"] == "20:00"
        assert got["sun"]["closed"] is True
    finally:
        requests.delete(f"{API}/admin/providers/{pid}", headers=h)


def test_provider_without_hours(h):
    payload = {
        "name": "TEST_ITER7_NoHours",
        "specialty": "General",
        "island": "Barbados",
        "address": "Test",
        "phone": "+1 246 000 0008",
        "email": "n@e.com",
        "description": "no hours",
    }
    r = requests.post(f"{API}/admin/providers", json=payload, headers=h)
    assert r.status_code in (200, 201)
    pid = r.json()["id"]
    try:
        g = requests.get(f"{API}/providers/{pid}")
        assert g.status_code == 200
        # hours should be None or absent
        assert not g.json().get("hours")
    finally:
        requests.delete(f"{API}/admin/providers/{pid}", headers=h)


# --- Article featured sort ---
def test_article_featured_first(h):
    a1 = {"title": "TEST_ITER7_ArticleA_NotFeatured", "content": "body A", "published": True, "featured": False}
    a2 = {"title": "TEST_ITER7_ArticleB_Featured", "content": "body B", "published": True, "featured": True}
    r1 = requests.post(f"{API}/admin/articles", json=a1, headers=h)
    assert r1.status_code in (200, 201), r1.text
    id1 = r1.json()["id"]
    r2 = requests.post(f"{API}/admin/articles", json=a2, headers=h)
    assert r2.status_code in (200, 201), r2.text
    id2 = r2.json()["id"]
    try:
        lst = requests.get(f"{API}/articles").json()
        # find our two
        titles = [a["title"] for a in lst]
        idx_a = titles.index("TEST_ITER7_ArticleA_NotFeatured")
        idx_b = titles.index("TEST_ITER7_ArticleB_Featured")
        assert idx_b < idx_a, f"Featured should come first: featured idx={idx_b}, non-featured idx={idx_a}"
        # verify featured field returned
        b = next(a for a in lst if a["id"] == id2)
        assert b.get("featured") is True
    finally:
        requests.delete(f"{API}/admin/articles/{id1}", headers=h)
        requests.delete(f"{API}/admin/articles/{id2}", headers=h)


# --- Regression ---
def test_admin_login_ok(h):
    r = requests.get(f"{API}/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json().get("role") == "admin"


def test_providers_list():
    r = requests.get(f"{API}/providers")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_reviews_list():
    r = requests.get(f"{API}/reviews")
    assert r.status_code == 200

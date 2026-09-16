"""Iteration 8: Country + Parish/Island (region) feature tests."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

created = {"providers": [], "articles": [], "events": []}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_stats_has_countries_covered():
    r = requests.get(f"{BASE_URL}/api/stats")
    assert r.status_code == 200
    data = r.json()
    assert "countries_covered" in data
    # legacy alias should NOT be primary; if present as well it's fine, but the new one is required.


def test_countries_endpoint():
    r = requests.get(f"{BASE_URL}/api/countries")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_provider_create_with_country_region(h):
    payload = {
        "name": "TEST_ITER8_Prov_JamKingston",
        "category": "Doctor",
        "country": "Jamaica",
        "region": "Kingston",
        "description": "test",
        "address": "1 Test Rd",
    }
    r = requests.post(f"{BASE_URL}/api/admin/providers", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    created["providers"].append(pid)

    # GET back
    g = requests.get(f"{BASE_URL}/api/providers/{pid}")
    assert g.status_code == 200
    assert g.json()["country"] == "Jamaica"
    assert g.json()["region"] == "Kingston"


def test_provider_filter_by_country_and_region(h):
    # ensure our record exists (from prev test); also create a Portland one? Instead just query
    r1 = requests.get(f"{BASE_URL}/api/providers", params={"country": "Jamaica"})
    assert r1.status_code == 200
    names = [p["name"] for p in r1.json()]
    assert "TEST_ITER8_Prov_JamKingston" in names

    r2 = requests.get(f"{BASE_URL}/api/providers", params={"country": "Jamaica", "region": "Kingston"})
    assert r2.status_code == 200
    names2 = [p["name"] for p in r2.json()]
    assert "TEST_ITER8_Prov_JamKingston" in names2

    r3 = requests.get(f"{BASE_URL}/api/providers", params={"country": "Jamaica", "region": "Portland"})
    assert r3.status_code == 200
    for p in r3.json():
        assert p["name"] != "TEST_ITER8_Prov_JamKingston"


def test_old_island_param_replaced(h):
    """Ensure using ?island= no longer scopes results (it's replaced by country)."""
    r = requests.get(f"{BASE_URL}/api/providers", params={"island": "Jamaica"})
    assert r.status_code == 200
    # if island param is ignored, list returns everything; that's expected
    # We only assert no server error occurred.


def test_article_country_region(h):
    payload = {
        "title": "TEST_ITER8_Article",
        "content": "hello",
        "category": "News",
        "country": "Barbados",
        "region": "Christ Church",
    }
    r = requests.post(f"{BASE_URL}/api/admin/articles", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    aid = r.json()["id"]
    created["articles"].append(aid)

    g = requests.get(f"{BASE_URL}/api/articles", params={"country": "Barbados", "region": "Christ Church"})
    assert g.status_code == 200
    titles = [a["title"] for a in g.json()]
    assert "TEST_ITER8_Article" in titles

    g2 = requests.get(f"{BASE_URL}/api/articles", params={"country": "Barbados", "region": "St. Michael"})
    assert "TEST_ITER8_Article" not in [a["title"] for a in g2.json()]


def test_event_country_region(h):
    payload = {
        "name": "TEST_ITER8_Event",
        "description": "d",
        "date": "2026-06-01",
        "country": "Trinidad & Tobago",
        "region": "Tobago",
    }
    r = requests.post(f"{BASE_URL}/api/admin/events", json=payload, headers=h)
    assert r.status_code in (200, 201), r.text
    eid = r.json()["id"]
    created["events"].append(eid)

    g = requests.get(f"{BASE_URL}/api/events", params={"country": "Trinidad & Tobago", "region": "Tobago"})
    assert g.status_code == 200
    names = [e.get("name") or e.get("title") for e in g.json()]
    assert "TEST_ITER8_Event" in names

    g2 = requests.get(f"{BASE_URL}/api/events", params={"country": "Trinidad & Tobago", "region": "Trinidad"})
    names2 = [e.get("name") or e.get("title") for e in g2.json()]
    assert "TEST_ITER8_Event" not in names2


def test_cleanup(h):
    for pid in created["providers"]:
        requests.delete(f"{BASE_URL}/api/admin/providers/{pid}", headers=h)
    for aid in created["articles"]:
        requests.delete(f"{BASE_URL}/api/admin/articles/{aid}", headers=h)
    for eid in created["events"]:
        requests.delete(f"{BASE_URL}/api/admin/events/{eid}", headers=h)
    # verify one
    if created["providers"]:
        g = requests.get(f"{BASE_URL}/api/providers/{created['providers'][0]}")
        assert g.status_code == 404

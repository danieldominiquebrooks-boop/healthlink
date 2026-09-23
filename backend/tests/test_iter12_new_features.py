"""Backend tests for iter12 new features:
- 2-step admin login (email 2FA)
- admin account update
- settings (public GET, admin PUT)
- visit tracking + analytics
- newsletter subscribe / admin subscribers CRUD / notify / unsubscribe
"""
import os
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://provider-finder-19.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "danieldominiquebrooks@gmail.com"
ADMIN_PASSWORD = "HealthLink@2026!"


def _mongo_code(challenge: str) -> str:
    out = subprocess.check_output([
        "mongosh", "test_database", "--quiet", "--eval",
        f"db.auth_challenges.findOne({{challenge:'{challenge}'}}).code"
    ], timeout=10).decode().strip()
    # strip quotes if any
    return out.replace("'", "").replace('"', '').strip()


@pytest.fixture(scope="session")
def admin_token():
    # Step 1: login
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("requires_2fa") is True
    challenge = j["challenge"]
    time.sleep(0.5)
    code = _mongo_code(challenge)
    assert code and len(code) == 6
    r2 = requests.post(f"{API}/auth/verify-2fa", json={"challenge": challenge, "code": code}, timeout=15)
    assert r2.status_code == 200, r2.text
    tok = r2.json()["access_token"]
    return tok


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- 2FA tests ----------------
class TestAuth2FA:
    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"}, timeout=15)
        assert r.status_code == 401

    def test_login_returns_challenge_and_masked_email(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert j["requires_2fa"] is True
        assert j["challenge"]
        assert "@" in j["email"] and "*" in j["email"]

    def test_verify_wrong_code_increments(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        challenge = r.json()["challenge"]
        r2 = requests.post(f"{API}/auth/verify-2fa", json={"challenge": challenge, "code": "000000"}, timeout=10)
        assert r2.status_code == 401

    def test_verify_correct_code_returns_token(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        challenge = r.json()["challenge"]
        time.sleep(0.5)
        code = _mongo_code(challenge)
        r2 = requests.post(f"{API}/auth/verify-2fa", json={"challenge": challenge, "code": code}, timeout=10)
        assert r2.status_code == 200
        j = r2.json()
        assert j["access_token"] and j["user"]["role"] == "admin"

    def test_verify_used_challenge_returns_400(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        challenge = r.json()["challenge"]
        time.sleep(0.5)
        code = _mongo_code(challenge)
        ok = requests.post(f"{API}/auth/verify-2fa", json={"challenge": challenge, "code": code}, timeout=10)
        assert ok.status_code == 200
        again = requests.post(f"{API}/auth/verify-2fa", json={"challenge": challenge, "code": code}, timeout=10)
        assert again.status_code == 400


# ---------------- Admin account update ----------------
class TestAccountUpdate:
    def test_wrong_current_password(self, auth_headers):
        r = requests.put(f"{API}/admin/account",
                         json={"current_password": "nope", "new_password": "AnotherPass123!"},
                         headers=auth_headers, timeout=15)
        assert r.status_code == 401

    def test_change_password_and_change_back(self, auth_headers):
        temp = "TempPass_HL2026!"
        r = requests.put(f"{API}/admin/account",
                         json={"current_password": ADMIN_PASSWORD, "new_password": temp},
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        # login with new password must work (returns 2FA)
        r2 = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": temp}, timeout=30)
        assert r2.status_code == 200
        # change BACK
        r3 = requests.put(f"{API}/admin/account",
                          json={"current_password": temp, "new_password": ADMIN_PASSWORD},
                          headers=auth_headers, timeout=15)
        assert r3.status_code == 200, r3.text
        # verify
        r4 = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r4.status_code == 200


# ---------------- Settings ----------------
class TestSettings:
    def test_settings_flow(self, auth_headers):
        payload = {
            "hero_heading": "TEST_Hero heading",
            "hero_subheading": "TEST_Hero tagline",
            "about_text": "TEST_About",
            "contact_email": "test@example.com",
            "contact_phone": "555-0100",
            "contact_address": "TEST_Street 1",
            "facebook_url": "https://facebook.com/test",
            "instagram_url": "https://instagram.com/test",
            "tiktok_url": "https://tiktok.com/@test",
        }
        r = requests.put(f"{API}/admin/settings", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        pub = requests.get(f"{API}/settings", timeout=15).json()
        for k, v in payload.items():
            assert pub.get(k) == v, f"{k} mismatch: {pub.get(k)} vs {v}"
        # RESET
        reset = {k: "" for k in payload.keys()}
        r2 = requests.put(f"{API}/admin/settings", json=reset, headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        pub2 = requests.get(f"{API}/settings", timeout=15).json()
        for k in payload.keys():
            assert pub2.get(k, "") == ""


# ---------------- Tracking + Analytics ----------------
class TestTracking:
    def test_track_fast_and_geolocation_backfill(self, auth_headers):
        session_id = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        t0 = time.time()
        r = requests.post(f"{API}/track",
                          json={"session_id": session_id, "path": "/blog", "referrer": ""},
                          timeout=5)
        dur = time.time() - t0
        assert r.status_code == 200
        assert dur < 2.0, f"track was too slow: {dur:.2f}s"
        vid = r.json()["visit_id"]
        assert vid
        # duration
        r2 = requests.post(f"{API}/track/duration", json={"visit_id": vid, "duration": 12.5}, timeout=10)
        assert r2.status_code == 200
        # allow bg geolocation to run
        time.sleep(3)
        # verify session appears in analytics
        an = requests.get(f"{API}/admin/analytics", headers=auth_headers, timeout=15)
        assert an.status_code == 200
        sessions = an.json()["sessions"]
        mine = [s for s in sessions if s["session_id"] == session_id]
        assert mine, "session not in analytics"
        s = mine[0]
        assert s["total_duration"] >= 12
        assert any(p["path"] == "/blog" for p in s["pages"])
        assert "ip" in s and "country" in s

    def test_analytics_requires_auth(self):
        r = requests.get(f"{API}/admin/analytics", timeout=10)
        assert r.status_code in (401, 403)


# ---------------- Newsletter ----------------
class TestNewsletter:
    def test_public_subscribe_and_admin_crud_and_unsubscribe(self, auth_headers):
        email = f"test_iter12_{uuid.uuid4().hex[:6]}@example.com"
        # public subscribe
        r = requests.post(f"{API}/subscribe", json={"email": email}, timeout=10)
        assert r.status_code == 200 and r.json()["ok"] is True
        # idempotent
        r2 = requests.post(f"{API}/subscribe", json={"email": email}, timeout=10)
        assert r2.status_code == 200
        # admin list contains it
        lst = requests.get(f"{API}/admin/subscribers", headers=auth_headers, timeout=10).json()
        rec = next((s for s in lst if s["email"] == email), None)
        assert rec is not None
        sid = rec["id"]
        token = rec["unsubscribe_token"]
        assert rec["active"] is True
        # toggle inactive
        rt = requests.put(f"{API}/admin/subscribers/{sid}", json={"active": False}, headers=auth_headers, timeout=10)
        assert rt.status_code == 200
        lst2 = requests.get(f"{API}/admin/subscribers", headers=auth_headers, timeout=10).json()
        assert next(s for s in lst2 if s["id"] == sid)["active"] is False
        # unsubscribe link (already inactive but returns ok)
        ur = requests.get(f"{API}/newsletter/unsubscribe", params={"token": token}, timeout=10)
        assert ur.status_code == 200
        assert "unsubscribed" in ur.text.lower()
        # admin add duplicate should 400
        radd = requests.post(f"{API}/admin/subscribers", json={"email": email}, headers=auth_headers, timeout=10)
        assert radd.status_code == 400
        # cleanup
        rd = requests.delete(f"{API}/admin/subscribers/{sid}", headers=auth_headers, timeout=10)
        assert rd.status_code == 200

    def test_admin_add_and_delete_subscriber(self, auth_headers):
        email = f"test_iter12_add_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/admin/subscribers", json={"email": email}, headers=auth_headers, timeout=10)
        assert r.status_code == 200
        sid = r.json()["id"]
        rd = requests.delete(f"{API}/admin/subscribers/{sid}", headers=auth_headers, timeout=10)
        assert rd.status_code == 200


# ---------------- Notify ----------------
class TestNotify:
    def test_notify_article_and_event(self, auth_headers):
        # ensure zero active subscribers so no real sends happen
        subs = requests.get(f"{API}/admin/subscribers", headers=auth_headers, timeout=10).json()
        for s in subs:
            if s.get("active"):
                requests.put(f"{API}/admin/subscribers/{s['id']}", json={"active": False}, headers=auth_headers, timeout=10)

        arts = requests.get(f"{API}/articles", timeout=10).json()
        evts = requests.get(f"{API}/events", timeout=10).json()
        if arts:
            aid = arts[0]["id"]
            r = requests.post(f"{API}/admin/articles/{aid}/notify", headers=auth_headers, timeout=15)
            assert r.status_code == 200
            j = r.json()
            assert j["ok"] is True and j["queued"] == 0
        if evts:
            eid = evts[0]["id"]
            r2 = requests.post(f"{API}/admin/events/{eid}/notify", headers=auth_headers, timeout=15)
            assert r2.status_code == 200
            assert r2.json()["queued"] == 0

    def test_notify_missing_returns_404(self, auth_headers):
        r = requests.post(f"{API}/admin/articles/nonexistent-id/notify", headers=auth_headers, timeout=10)
        assert r.status_code == 404

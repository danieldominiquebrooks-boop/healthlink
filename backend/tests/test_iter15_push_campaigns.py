"""Iteration 15 - Web Push + Campaign analytics (open/click tracking)."""
import os
import time
import uuid
import subprocess
import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-finder-19.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("HL_TOKEN") or open("/tmp/hl_token").read().strip()
AUTH = {"Authorization": f"Bearer {TOKEN}"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]


# ---------- cleanup helpers ----------
CREATED = {"articles": [], "events": [], "campaigns": [], "recipients": [], "push": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup_after():
    yield
    if CREATED["articles"]:
        db.articles.delete_many({"id": {"$in": CREATED["articles"]}})
    if CREATED["events"]:
        db.events.delete_many({"id": {"$in": CREATED["events"]}})
    if CREATED["campaigns"]:
        db.campaigns.delete_many({"id": {"$in": CREATED["campaigns"]}})
    # Also delete campaigns matching our QA titles/refs
    db.campaigns.delete_many({"title": {"$regex": "^QA Announce "}})
    db.campaigns.delete_many({"ref_id": {"$in": CREATED["articles"] + CREATED["events"]}})
    if CREATED["recipients"]:
        db.campaign_recipients.delete_many({"token": {"$in": CREATED["recipients"]}})
    if CREATED["push"]:
        db.push_subscriptions.delete_many({"endpoint": {"$in": CREATED["push"]}})


# ---------- Push endpoints ----------
class TestPush:
    def test_vapid_public_key(self):
        r = requests.get(f"{BASE}/api/push/vapid-public-key")
        assert r.status_code == 200
        data = r.json()
        assert "public_key" in data
        assert isinstance(data["public_key"], str)
        assert len(data["public_key"]) > 20

    def test_subscribe_upsert_and_unsubscribe(self):
        endpoint = "https://example.com/ep-TEST1"
        CREATED["push"].append(endpoint)
        payload = {
            "subscription": {
                "endpoint": endpoint,
                "keys": {"p256dh": "BJx_dummy_key_TEST", "auth": "abc"},
            },
            "email": None,
        }
        r1 = requests.post(f"{BASE}/api/push/subscribe", json=payload)
        assert r1.status_code == 200, r1.text
        assert r1.json() == {"ok": True}
        # repeat -> upsert (no duplicate)
        r2 = requests.post(f"{BASE}/api/push/subscribe", json=payload)
        assert r2.status_code == 200
        assert db.push_subscriptions.count_documents({"endpoint": endpoint}) == 1

        # admin count reflects
        rc = requests.get(f"{BASE}/api/admin/push/count", headers=AUTH)
        assert rc.status_code == 200
        assert rc.json()["count"] >= 1

        # unauth denied
        rc_noauth = requests.get(f"{BASE}/api/admin/push/count")
        assert rc_noauth.status_code in (401, 403)

        # unsubscribe
        ru = requests.post(f"{BASE}/api/push/unsubscribe", json={"endpoint": endpoint})
        assert ru.status_code == 200
        assert ru.json() == {"ok": True}
        assert db.push_subscriptions.count_documents({"endpoint": endpoint}) == 0

    def test_subscribe_invalid(self):
        r = requests.post(f"{BASE}/api/push/subscribe", json={"subscription": {"endpoint": "x"}})
        assert r.status_code == 400


# ---------- Tracking (open/click) - seed campaign directly ----------
class TestTracking:
    @classmethod
    def setup_class(cls):
        cls.cid = str(uuid.uuid4())
        cls.link = "https://provider-finder-19.preview.emergentagent.com/blog/qa-track-x"
        db.campaigns.insert_one({
            "id": cls.cid, "kind": "article", "ref_id": "qa-ref-1",
            "title": "QA Announce Track Test", "link": cls.link,
            "created_at": "2026-01-01T00:00:00Z",
            "email_sent": 1, "email_opened": 0, "email_clicked": 0,
            "push_sent": 0, "push_clicked": 0,
        })
        CREATED["campaigns"].append(cls.cid)
        # email recipient
        db.campaign_recipients.insert_one({
            "token": "qa_tok_email", "campaign_id": cls.cid, "channel": "email",
            "opened": False, "clicked": False, "created_at": "2026-01-01T00:00:00Z",
        })
        # push recipient
        db.campaign_recipients.insert_one({
            "token": "qa_tok_push", "campaign_id": cls.cid, "channel": "push",
            "opened": False, "clicked": False, "created_at": "2026-01-01T00:00:00Z",
        })
        CREATED["recipients"].extend(["qa_tok_email", "qa_tok_push"])

    def test_email_open_dedup(self):
        r1 = requests.get(f"{BASE}/api/track/open/qa_tok_email.gif", allow_redirects=False)
        assert r1.status_code == 200
        assert r1.headers.get("content-type", "").startswith("image/gif")
        r2 = requests.get(f"{BASE}/api/track/open/qa_tok_email.gif")
        assert r2.status_code == 200
        camp = db.campaigns.find_one({"id": self.cid})
        assert camp["email_opened"] == 1, f"expected dedupe -> 1, got {camp['email_opened']}"

    def test_email_click_redirect_and_counter(self):
        r = requests.get(f"{BASE}/api/track/click/qa_tok_email", allow_redirects=False)
        assert r.status_code == 302
        assert r.headers.get("location") == self.link
        camp = db.campaigns.find_one({"id": self.cid})
        assert camp["email_clicked"] == 1
        assert camp["email_opened"] == 1

    def test_push_click_only_increments_push_clicked(self):
        r = requests.get(f"{BASE}/api/track/click/qa_tok_push", allow_redirects=False)
        assert r.status_code == 302
        assert r.headers.get("location") == self.link
        camp = db.campaigns.find_one({"id": self.cid})
        assert camp["push_clicked"] == 1
        # email_clicked stays at 1 (from previous test) - i.e., not incremented by push
        assert camp["email_clicked"] == 1

    def test_invalid_click_404(self):
        r = requests.get(f"{BASE}/api/track/click/qa_bogus_nonexistent_token_xyz", allow_redirects=False)
        assert r.status_code == 404

    def test_invalid_open_still_returns_gif(self):
        r = requests.get(f"{BASE}/api/track/open/qa_bogus_nonexistent_token_xyz.gif")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/gif")


# ---------- Campaign auto-creation on publish + admin listing ----------
class TestCampaignsListing:
    def test_admin_campaigns_requires_auth(self):
        r = requests.get(f"{BASE}/api/admin/campaigns")
        assert r.status_code in (401, 403)

    def test_publish_article_creates_campaign(self):
        payload = {
            "title": "QA Announce Article Iter15",
            "excerpt": "x",
            "content": "<p>x</p>",
            "published": True,
        }
        r = requests.post(f"{BASE}/api/admin/articles", headers=AUTH, json=payload)
        assert r.status_code in (200, 201), r.text
        art = r.json()
        aid = art["id"]
        CREATED["articles"].append(aid)
        # give background task time
        time.sleep(2.5)
        # find campaign
        camps = requests.get(f"{BASE}/api/admin/campaigns", headers=AUTH).json()
        matching = [c for c in camps if c.get("kind") == "article" and c.get("ref_id") == aid]
        assert matching, "no campaign row auto-created for article"
        c = matching[0]
        assert c["title"] == payload["title"]
        # 0 subscribers -> 0 sent
        assert c["email_sent"] == 0
        assert c["push_sent"] == 0
        CREATED["campaigns"].append(c["id"])
        # sorted newest first
        assert camps == sorted(camps, key=lambda x: x.get("created_at", ""), reverse=True)

    def test_publish_event_creates_campaign(self):
        payload = {
            "name": "QA Announce Event Iter15",
            "description": "x",
            "starts_at": "2026-12-31T10:00:00Z",
            "location": "Nassau",
            "published": True,
        }
        r = requests.post(f"{BASE}/api/admin/events", headers=AUTH, json=payload)
        assert r.status_code in (200, 201), r.text
        eid = r.json()["id"]
        CREATED["events"].append(eid)
        time.sleep(2.5)
        camps = requests.get(f"{BASE}/api/admin/campaigns", headers=AUTH).json()
        matching = [c for c in camps if c.get("kind") == "event" and c.get("ref_id") == eid]
        assert matching, "no campaign row auto-created for event"
        CREATED["campaigns"].append(matching[0]["id"])

    def test_manual_notify_creates_additional_campaign_rows(self):
        """Per review-request: manual notify endpoints should each create an ADDITIONAL campaign row."""
        assert CREATED["articles"], "need a prior article id"
        aid = CREATED["articles"][0]
        before = len([c for c in requests.get(f"{BASE}/api/admin/campaigns", headers=AUTH).json()
                      if c.get("kind") == "article" and c.get("ref_id") == aid])
        r = requests.post(f"{BASE}/api/admin/articles/{aid}/notify", headers=AUTH)
        assert r.status_code == 200
        time.sleep(2.0)
        after_list = requests.get(f"{BASE}/api/admin/campaigns", headers=AUTH).json()
        after = len([c for c in after_list if c.get("kind") == "article" and c.get("ref_id") == aid])
        # Track newly created campaigns for cleanup regardless
        for c in after_list:
            if c.get("ref_id") == aid:
                CREATED["campaigns"].append(c["id"])
        assert after == before + 1, f"manual article notify did not create new campaign row (before={before}, after={after})"

        # Repeat for event
        eid = CREATED["events"][0]
        before_e = len([c for c in requests.get(f"{BASE}/api/admin/campaigns", headers=AUTH).json()
                        if c.get("kind") == "event" and c.get("ref_id") == eid])
        r = requests.post(f"{BASE}/api/admin/events/{eid}/notify", headers=AUTH)
        assert r.status_code == 200
        time.sleep(2.0)
        after_list = requests.get(f"{BASE}/api/admin/campaigns", headers=AUTH).json()
        after_e = len([c for c in after_list if c.get("kind") == "event" and c.get("ref_id") == eid])
        for c in after_list:
            if c.get("ref_id") == eid:
                CREATED["campaigns"].append(c["id"])
        assert after_e == before_e + 1, f"manual event notify did not create new campaign row"

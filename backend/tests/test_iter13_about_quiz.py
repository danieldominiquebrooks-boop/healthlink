"""Iteration 13: About page + Quiz system + Analytics date-range tests.
Reuses a pre-fetched JWT via env var HL_TOKEN to avoid Resend 429 lockout.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-finder-19.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("HL_TOKEN", "").strip()


@pytest.fixture(scope="session")
def auth_headers():
    if not TOKEN:
        pytest.skip("HL_TOKEN not provided")
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --------------------------- About ---------------------------
class TestAbout:
    def test_public_about_get(self, api):
        r = api.get(f"{BASE_URL}/api/about")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_admin_about_put_and_public_read(self, api, auth_headers):
        payload = {
            "heading": "TEST_About Heading",
            "story": "<p>TEST story <b>bold</b></p>",
            "image_url": "https://example.com/hero.jpg",
            "team": [
                {"name": "TEST_Alice", "role": "Doctor", "photo": "https://example.com/a.jpg", "bio": "Bio A"},
                {"name": "TEST_Bob", "role": "Nurse", "photo": "", "bio": "Bio B"},
            ],
        }
        r = api.put(f"{BASE_URL}/api/admin/about", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["heading"] == payload["heading"]
        assert len(data["team"]) == 2

        r2 = api.get(f"{BASE_URL}/api/about")
        assert r2.status_code == 200
        pub = r2.json()
        assert pub["heading"] == payload["heading"]
        assert pub["story"] == payload["story"]
        assert pub["team"][0]["name"] == "TEST_Alice"

    def test_about_requires_auth(self, api):
        r = api.put(f"{BASE_URL}/api/admin/about", json={"heading": "x"})
        assert r.status_code in (401, 403)


# --------------------------- Quiz ---------------------------
@pytest.fixture(scope="class")
def created_quiz(api, auth_headers):
    payload = {
        "title": f"TEST_Quiz_{uuid.uuid4().hex[:6]}",
        "description": "test desc",
        "result_message": "Thanks for taking the TEST quiz.",
        "popup_delay_seconds": 2,
        "active": True,
        "questions": [
            {"text": "Q1?", "options": ["A", "B", "C"]},
            {"text": "Q2?", "options": ["Yes", "No"]},
        ],
    }
    r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    q = r.json()
    yield q
    api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)


class TestQuizCRUD:
    def test_create_has_id_and_qids(self, created_quiz):
        assert "id" in created_quiz
        assert all(q.get("id") for q in created_quiz["questions"])

    def test_list_has_response_count(self, api, auth_headers, created_quiz):
        r = api.get(f"{BASE_URL}/api/admin/quizzes", headers=auth_headers)
        assert r.status_code == 200
        found = [q for q in r.json() if q["id"] == created_quiz["id"]]
        assert found and "response_count" in found[0]

    def test_public_active_quiz_no_answer_key(self, api, created_quiz):
        r = api.get(f"{BASE_URL}/api/quiz/active")
        assert r.status_code == 200
        q = r.json()
        assert q and q["id"] == created_quiz["id"]
        # Ensure question ids are exposed and no hidden answer field leaks
        for question in q["questions"]:
            assert question.get("id")
            assert "answer" not in question
            assert "correct" not in question

    def test_single_active_enforcement_on_create(self, api, auth_headers, created_quiz):
        # Create another active quiz — the first should become inactive
        payload = {
            "title": f"TEST_Quiz2_{uuid.uuid4().hex[:6]}",
            "popup_delay_seconds": 2,
            "active": True,
            "questions": [{"text": "Q?", "options": ["a", "b"]}],
        }
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        assert r.status_code == 200
        q2 = r.json()
        try:
            listing = api.get(f"{BASE_URL}/api/admin/quizzes", headers=auth_headers).json()
            active_ids = [q["id"] for q in listing if q.get("active")]
            assert q2["id"] in active_ids
            assert created_quiz["id"] not in active_ids
            # Public /quiz/active returns q2
            pub = api.get(f"{BASE_URL}/api/quiz/active").json()
            assert pub["id"] == q2["id"]

            # Re-activate created_quiz via PUT
            r_up = api.put(
                f"{BASE_URL}/api/admin/quizzes/{created_quiz['id']}",
                json={
                    "title": created_quiz["title"],
                    "popup_delay_seconds": 2,
                    "active": True,
                    "questions": created_quiz["questions"],
                    "result_message": created_quiz.get("result_message", ""),
                },
                headers=auth_headers,
            )
            assert r_up.status_code == 200
            listing = api.get(f"{BASE_URL}/api/admin/quizzes", headers=auth_headers).json()
            active_ids = [q["id"] for q in listing if q.get("active")]
            assert created_quiz["id"] in active_ids
            assert q2["id"] not in active_ids
        finally:
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q2['id']}", headers=auth_headers)

    def test_submit_creates_response_and_subscriber(self, api, auth_headers, created_quiz):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        qs = created_quiz["questions"]
        payload = {
            "quiz_id": created_quiz["id"],
            "name": "TEST User",
            "email": email,
            "age": "25-34",
            "answers": [
                {"question_id": qs[0]["id"], "answer": "A"},
                {"question_id": qs[1]["id"], "answer": "Yes"},
            ],
        }
        r = api.post(f"{BASE_URL}/api/quiz/submit", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Subscriber added
        subs = api.get(f"{BASE_URL}/api/admin/subscribers", headers=auth_headers).json()
        assert any(s["email"] == email and s.get("active") for s in subs)

        # Analysis reflects response
        an = api.get(
            f"{BASE_URL}/api/admin/quizzes/{created_quiz['id']}/analysis",
            headers=auth_headers,
        ).json()
        assert an["total"] >= 1
        assert an["questions"][0]["counts"].get("A", 0) >= 1
        assert any(r_["email"] == email for r_ in an["responses"])
        assert "25-34" in an["ages"]

        # Cleanup subscriber
        target = next(s for s in subs if s["email"] == email)
        api.delete(f"{BASE_URL}/api/admin/subscribers/{target['id']}", headers=auth_headers)

    def test_submit_invalid_quiz_404(self, api):
        r = api.post(f"{BASE_URL}/api/quiz/submit", json={
            "quiz_id": "nonexistent-id",
            "name": "x", "email": "TEST_x@example.com", "age": "", "answers": [],
        })
        assert r.status_code == 404

    def test_analysis_date_range_empty(self, api, auth_headers, created_quiz):
        # Very old date range should return 0
        r = api.get(
            f"{BASE_URL}/api/admin/quizzes/{created_quiz['id']}/analysis",
            params={"start": "2000-01-01", "end": "2000-01-02"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0


# --------------------------- Analytics date range ---------------------------
class TestAnalyticsDateRange:
    def test_analytics_no_range(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "sessions" in body and "total_sessions" in body and "total_pageviews" in body

    def test_analytics_old_range_zero(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/admin/analytics",
                    params={"start": "2000-01-01", "end": "2000-01-02"},
                    headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["total_sessions"] == 0
        assert body["sessions"] == []


# --------------------------- Regression basics ---------------------------
class TestRegression:
    def test_providers_still_work(self, api):
        r = api.get(f"{BASE_URL}/api/providers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_settings_still_work(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

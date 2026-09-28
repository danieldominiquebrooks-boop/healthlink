"""Iteration 14: Quiz enhancements (points+tiers, scheduling, CSV export) + region counts.
Reuses pre-fetched JWT via env HL_TOKEN to avoid Resend 429 lockout.
"""
import os
import uuid
from datetime import date, timedelta

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


def _quiz_payload(active=True, start=None, end=None, tiers=None):
    return {
        "title": f"TEST_Q14_{uuid.uuid4().hex[:6]}",
        "description": "iter14 test",
        "result_message": "Default fallback message",
        "result_tiers": tiers if tiers is not None else [
            {"min_points": 0, "message": "Low tier **bold**"},
            {"min_points": 5, "message": "Mid tier"},
            {"min_points": 10, "message": "High tier"},
        ],
        "popup_delay_seconds": 1,
        "active": active,
        "start_date": start or "",
        "end_date": end or "",
        "questions": [
            {"text": "Q1?", "options": [
                {"text": "Low", "points": 1},
                {"text": "Mid", "points": 5},
                {"text": "High", "points": 10},
            ]},
            {"text": "Q2?", "options": [
                {"text": "Yes", "points": 2},
                {"text": "No", "points": 0},
            ]},
        ],
    }


class TestQuizPointsAndTiers:
    def test_create_with_object_options_and_tiers(self, api, auth_headers):
        payload = _quiz_payload(active=False)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        q = r.json()
        try:
            assert q["result_tiers"] and q["result_tiers"][0]["min_points"] == 0
            # Ensure options preserved as objects with points
            for question in q["questions"]:
                for opt in question["options"]:
                    assert "text" in opt and "points" in opt
        finally:
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)

    def test_submit_stores_points_and_analysis_counts(self, api, auth_headers):
        payload = _quiz_payload(active=True)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        assert r.status_code == 200
        q = r.json()
        try:
            # High-point answers: 10 + 2 = 12
            qs = q["questions"]
            email = f"test_pts_{uuid.uuid4().hex[:6]}@example.com"
            sub = {
                "quiz_id": q["id"],
                "name": "TEST User",
                "email": email,
                "age": "25-34",
                "answers": [
                    {"question_id": qs[0]["id"], "answer": "High"},
                    {"question_id": qs[1]["id"], "answer": "Yes"},
                ],
            }
            r2 = api.post(f"{BASE_URL}/api/quiz/submit", json=sub)
            assert r2.status_code == 200, r2.text
            assert r2.json()["ok"] is True

            an = api.get(f"{BASE_URL}/api/admin/quizzes/{q['id']}/analysis",
                         headers=auth_headers).json()
            match = [x for x in an["responses"] if x["email"] == email]
            assert match, "response missing"
            assert match[0]["points"] == 12, f"expected 12 got {match[0]['points']}"
            # per-question counts still aggregate using object options
            q1 = next(x for x in an["questions"] if x["text"] == "Q1?")
            assert q1["counts"].get("High", 0) >= 1
        finally:
            # Cleanup subscriber
            subs = api.get(f"{BASE_URL}/api/admin/subscribers", headers=auth_headers).json()
            for s in subs:
                if s["email"].startswith("test_pts_"):
                    api.delete(f"{BASE_URL}/api/admin/subscribers/{s['id']}", headers=auth_headers)
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)

    def test_submit_low_points_uses_lowest_tier(self, api, auth_headers):
        payload = _quiz_payload(active=True)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        q = r.json()
        try:
            qs = q["questions"]
            email = f"test_low_{uuid.uuid4().hex[:6]}@example.com"
            sub = {
                "quiz_id": q["id"], "name": "TEST", "email": email, "age": "",
                "answers": [
                    {"question_id": qs[0]["id"], "answer": "Low"},
                    {"question_id": qs[1]["id"], "answer": "No"},
                ],
            }
            r2 = api.post(f"{BASE_URL}/api/quiz/submit", json=sub)
            assert r2.status_code == 200
            an = api.get(f"{BASE_URL}/api/admin/quizzes/{q['id']}/analysis",
                         headers=auth_headers).json()
            match = [x for x in an["responses"] if x["email"] == email]
            assert match[0]["points"] == 1
        finally:
            subs = api.get(f"{BASE_URL}/api/admin/subscribers", headers=auth_headers).json()
            for s in subs:
                if s["email"].startswith("test_low_"):
                    api.delete(f"{BASE_URL}/api/admin/subscribers/{s['id']}", headers=auth_headers)
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)


class TestQuizScheduling:
    def test_future_start_date_hides_active(self, api, auth_headers):
        future = (date.today() + timedelta(days=7)).isoformat()
        payload = _quiz_payload(active=True, start=future)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        q = r.json()
        try:
            pub = api.get(f"{BASE_URL}/api/quiz/active").json()
            assert pub is None, f"expected None got {pub}"
        finally:
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)

    def test_past_end_date_hides_active(self, api, auth_headers):
        past = (date.today() - timedelta(days=7)).isoformat()
        payload = _quiz_payload(active=True, end=past)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        q = r.json()
        try:
            pub = api.get(f"{BASE_URL}/api/quiz/active").json()
            assert pub is None
        finally:
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)

    def test_within_window_shows_active(self, api, auth_headers):
        start = (date.today() - timedelta(days=1)).isoformat()
        end = (date.today() + timedelta(days=1)).isoformat()
        payload = _quiz_payload(active=True, start=start, end=end)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        q = r.json()
        try:
            pub = api.get(f"{BASE_URL}/api/quiz/active").json()
            assert pub and pub["id"] == q["id"]
        finally:
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)

    def test_public_active_options_are_strings_no_points(self, api, auth_headers):
        payload = _quiz_payload(active=True)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        q = r.json()
        try:
            pub = api.get(f"{BASE_URL}/api/quiz/active").json()
            assert pub and pub["id"] == q["id"]
            for question in pub["questions"]:
                for opt in question["options"]:
                    assert isinstance(opt, str), f"option leaked as {type(opt)}: {opt}"
                # Ensure no answer/points fields on question
                assert "points" not in question
        finally:
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)


class TestCSVExport:
    def test_csv_export_headers_and_row(self, api, auth_headers):
        payload = _quiz_payload(active=True)
        r = api.post(f"{BASE_URL}/api/admin/quizzes", json=payload, headers=auth_headers)
        q = r.json()
        try:
            qs = q["questions"]
            email = f"test_csv_{uuid.uuid4().hex[:6]}@example.com"
            sub = {
                "quiz_id": q["id"], "name": "TEST Csv", "email": email, "age": "35-44",
                "answers": [
                    {"question_id": qs[0]["id"], "answer": "Mid"},
                    {"question_id": qs[1]["id"], "answer": "Yes"},
                ],
            }
            assert api.post(f"{BASE_URL}/api/quiz/submit", json=sub).status_code == 200

            r_csv = api.get(f"{BASE_URL}/api/admin/quizzes/{q['id']}/responses.csv",
                            headers={"Authorization": auth_headers["Authorization"]})
            assert r_csv.status_code == 200
            assert "text/csv" in r_csv.headers.get("content-type", "")
            body = r_csv.text
            first = body.splitlines()[0]
            assert first.startswith("Date,Name,Email,Age,Points,")
            assert "Q1?" in first and "Q2?" in first
            assert email in body
            assert "Mid" in body
            # Points col = 5 + 2 = 7
            assert ",7," in body or ",7\r" in body or body.rstrip().endswith(",7")
        finally:
            subs = api.get(f"{BASE_URL}/api/admin/subscribers", headers=auth_headers).json()
            for s in subs:
                if s["email"].startswith("test_csv_"):
                    api.delete(f"{BASE_URL}/api/admin/subscribers/{s['id']}", headers=auth_headers)
            api.delete(f"{BASE_URL}/api/admin/quizzes/{q['id']}", headers=auth_headers)

    def test_csv_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/quizzes/none/responses.csv")
        assert r.status_code in (401, 403)


class TestRegionCounts:
    def test_regions_counts_bahamas(self, api):
        r = api.get(f"{BASE_URL}/api/regions/counts", params={"country": "Bahamas"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        # Should have at least one parish with providers
        assert data, "expected non-empty region counts for Bahamas"
        for k, v in data.items():
            assert isinstance(k, str) and isinstance(v, int) and v > 0

    def test_regions_counts_unknown_country_empty(self, api):
        r = api.get(f"{BASE_URL}/api/regions/counts", params={"country": "Atlantis-NoSuch"})
        assert r.status_code == 200
        assert r.json() == {}


class TestRegression:
    def test_providers(self, api):
        r = api.get(f"{BASE_URL}/api/providers")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_settings(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200

    def test_about(self, api):
        r = api.get(f"{BASE_URL}/api/about")
        assert r.status_code == 200

    def test_analytics_auth(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers)
        assert r.status_code == 200
        assert "sessions" in r.json()

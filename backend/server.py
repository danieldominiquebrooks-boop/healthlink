from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import Response, HTMLResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import logging
import jwt
import bcrypt
import re
import csv
import io
import asyncio
import httpx
import requests
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import ipaddress
import json
import base64
from pywebpush import webpush, WebPushException
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

# ----------------------------------------------------------------------------
# Setup
# ----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="My Healthcare Link API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("healthlink")

ISLANDS = [
    "Barbados", "Jamaica", "Trinidad & Tobago", "Saint Lucia", "Bahamas",
    "Cayman Islands", "Grenada", "Antigua & Barbuda", "Dominica",
    "Saint Vincent & the Grenadines", "Saint Kitts & Nevis", "Guyana",
]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def new_id():
    return str(uuid.uuid4())

def slugify(text: str) -> str:
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return s or new_id()[:8]

def apply_region_filter(query: dict, region: Optional[str]) -> None:
    """Filter by parish/island, but ALSO include country-wide items (no region set)
    so an entry added without a parish is visible in every parish of its country."""
    if region and region not in ("All Parishes", "All Parishes/Islands"):
        query.setdefault("$and", []).append({"$or": [
            {"region": region},
            {"region": {"$in": ["", None]}},
            {"region": {"$exists": False}},
        ]})

# ----------------------------------------------------------------------------
# Object storage
# ----------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "healthlink"
storage_key = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    url = f"{STORAGE_URL}/objects/{path}"
    resp = requests.put(url, headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(url, headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    url = f"{STORAGE_URL}/objects/{path}"
    resp = requests.get(url, headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(url, headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ----------------------------------------------------------------------------
# Email (Emergent-managed Resend) + guardrail gate
# ----------------------------------------------------------------------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "My Healthcare Link")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@myhealthcarelink.app")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str, reply_to: str = None):
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    last = None
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        if resp.status_code == 429 and attempt < 2:
            await asyncio.sleep(2 * (attempt + 1))  # backoff on rate limit
            last = resp
            continue
        resp.raise_for_status()
        return resp.json().get("id")
    if last is not None:
        last.raise_for_status()

def _twofa_html(code: str) -> str:
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;background:#FAF7F2">'
            f'<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">'
            f'<h1 style="color:#0B132B;margin:0 0 8px;font-size:22px">{escape(EMAIL_FROM_NAME)}</h1>'
            f'<p style="color:#334155;font-size:15px">Your admin login verification code is:</p>'
            f'<p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#0B132B;background:#FDF7E7;'
            f'border-radius:12px;text-align:center;padding:16px 0;margin:16px 0">{escape(code)}</p>'
            f'<p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you did not try to sign in, '
            f'you can safely ignore this email &mdash; no one can access your account without it.</p>'
            f'<p style="font-size:12px;color:#94a3b8;margin-top:24px">Sent by {escape(EMAIL_FROM_NAME)}. '
            f'We never ask for your password by email.</p></div></td></tr></table>')

def _newsletter_html(heading: str, title: str, summary: str, link: str, unsub: str, pixel: str = "") -> str:
    pixel_tag = f'<img src="{escape(pixel)}" width="1" height="1" alt="" style="display:none">' if pixel else ""
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;background:#FAF7F2">'
            f'<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">'
            f'<h1 style="color:#0B132B;margin:0 0 4px;font-size:20px">{escape(EMAIL_FROM_NAME)}</h1>'
            f'<p style="color:#B8912B;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px">{escape(heading)}</p>'
            f'<h2 style="color:#0F172A;font-size:22px;margin:0 0 12px">{escape(title)}</h2>'
            f'<p style="color:#334155;font-size:15px;line-height:1.6">{escape(summary or "")}</p>'
            f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#0B132B;color:#fff;text-decoration:none;'
            f'padding:12px 24px;border-radius:10px;font-weight:bold;display:inline-block">Read more</a></p>'
            f'<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
            f'<p style="font-size:12px;color:#94a3b8">You are receiving this because you subscribed to updates from '
            f'{escape(EMAIL_FROM_NAME)}. <a href="{escape(unsub)}" style="color:#94a3b8">Unsubscribe</a>.</p>'
            f'</div>{pixel_tag}</td></tr></table>')

# ----------------------------------------------------------------------------
# IP geolocation (free, keyless) + client IP
# ----------------------------------------------------------------------------
_ip_geo_cache = {}

def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else ""

async def geolocate_ip(ip: str) -> dict:
    if not ip or ip.startswith(("127.", "10.", "192.168.", "172.")) or ip in ("localhost", "testclient", "::1"):
        return {"country": "", "city": ""}
    if ip in _ip_geo_cache:
        return _ip_geo_cache[ip]
    res = {"country": "", "city": ""}
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get(f"https://ipapi.co/{ip}/json/", headers={"User-Agent": "MyHealthcareLink/1.0"})
            r.raise_for_status()
            d = r.json()
            res = {"country": d.get("country_name") or "", "city": d.get("city") or ""}
    except Exception as e:
        logger.error(f"IP geolocation failed for {ip}: {e}")
    _ip_geo_cache[ip] = res
    return res

def public_base(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    return f"https://{host}" if host else ""

# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_admin(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str

class ProviderBase(BaseModel):
    name: str
    specialty: Optional[str] = ""
    specialties: List[str] = Field(default_factory=list)
    category: Optional[str] = ""
    niches: List[str] = Field(default_factory=list)
    description: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    address: Optional[str] = ""
    country: Optional[str] = ""
    region: Optional[str] = ""
    image_url: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    hours: Optional[Dict[str, Any]] = None
    services: List[str] = Field(default_factory=list)
    in_network: bool = False
    accepting_new_patients: bool = True
    verified: bool = False
    featured: bool = False
    active: bool = True

class CategoryBase(BaseModel):
    name: str
    type: str = "specialty"  # specialty | service | niche | category
    icon: Optional[str] = "stethoscope"
    description: Optional[str] = ""

class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = ""
    country: Optional[str] = ""
    region: Optional[str] = ""
    icon: Optional[str] = "activity"
    active: bool = True

class ArticleBase(BaseModel):
    title: str
    excerpt: Optional[str] = ""
    content: Optional[str] = ""
    category: Optional[str] = ""
    country: Optional[str] = ""
    region: Optional[str] = ""
    image_url: Optional[str] = ""
    author: Optional[str] = "My Healthcare Link"
    published: bool = True
    featured: bool = False

class EventBase(BaseModel):
    name: str
    date: Optional[str] = ""
    time: Optional[str] = ""
    location: Optional[str] = ""
    country: Optional[str] = ""
    region: Optional[str] = ""
    description: Optional[str] = ""
    organizer: Optional[str] = ""
    registration_info: Optional[str] = ""
    registration_url: Optional[str] = ""
    image_url: Optional[str] = ""
    external_links: List[str] = Field(default_factory=list)
    published: bool = True

class ReviewCreate(BaseModel):
    provider_id: str
    author_name: str
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = ""
    comment: str
    country: Optional[str] = ""
    region: Optional[str] = ""
    verified_patient: bool = False

class SettingsUpdate(BaseModel):
    site_title: Optional[str] = None
    hero_heading: Optional[str] = None
    hero_subheading: Optional[str] = None
    about_text: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None

# ----------------------------------------------------------------------------
# Helpers to enrich providers with ratings
# ----------------------------------------------------------------------------
async def provider_rating(provider_id: str):
    pipeline = [
        {"$match": {"provider_id": provider_id, "status": "approved"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    res = await db.reviews.aggregate(pipeline).to_list(1)
    if res:
        return round(res[0]["avg"], 1), res[0]["count"]
    return 0.0, 0

async def enrich_provider(doc: dict):
    doc.pop("_id", None)
    rating, count = await provider_rating(doc["id"])
    doc["rating"] = rating
    doc["review_count"] = count
    return doc

# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
class Verify2FAInput(BaseModel):
    challenge: str
    code: str

class AccountUpdate(BaseModel):
    current_password: str
    new_email: Optional[EmailStr] = None
    new_password: Optional[str] = None

def _mask_email(e: str) -> str:
    name, _, dom = e.partition("@")
    masked = (name[0] + "*") if len(name) <= 2 else (name[0] + "*" * (len(name) - 2) + name[-1])
    return f"{masked}@{dom}"

@api_router.post("/auth/login")
async def login(payload: LoginInput):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    # Reuse a still-fresh, unused code (avoids duplicate emails + Resend rate limits
    # when the admin clicks Continue/Resend repeatedly). Stored only after a successful send.
    recent = await db.auth_challenges.find_one({
        "user_id": uid, "used": False,
        "expires_at": {"$gt": now},
        "created_dt": {"$gt": now - timedelta(seconds=90)},
    })
    if recent:
        return {"requires_2fa": True, "challenge": recent["challenge"], "email": _mask_email(email)}
    code = f"{secrets.randbelow(1000000):06d}"
    challenge = secrets.token_urlsafe(24)
    try:
        await send_email(to=email, subject=f"Your {EMAIL_FROM_NAME} login code", html=_twofa_html(code))
    except Exception as e:
        logger.error(f"2FA email failed for {email}: {e}")
        raise HTTPException(status_code=502, detail="Could not send your verification code right now. Please wait a moment and try again.")
    # Invalidate older unused challenges so only the newest code is valid.
    await db.auth_challenges.update_many({"user_id": uid, "used": False}, {"$set": {"used": True}})
    await db.auth_challenges.insert_one({
        "challenge": challenge, "user_id": uid, "email": email,
        "code": code, "attempts": 0, "used": False,
        "expires_at": now + timedelta(minutes=10),
        "created_dt": now, "created_at": now_iso(),
    })
    return {"requires_2fa": True, "challenge": challenge, "email": _mask_email(email)}

@api_router.post("/auth/verify-2fa")
async def verify_2fa(payload: Verify2FAInput):
    ch = await db.auth_challenges.find_one({"challenge": payload.challenge})
    if not ch or ch.get("used"):
        raise HTTPException(status_code=400, detail="This login session expired. Please sign in again.")
    exp = ch["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="Your code expired. Please sign in again.")
    if ch.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please sign in again.")
    if payload.code.strip() != ch["code"]:
        await db.auth_challenges.update_one({"challenge": payload.challenge}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=401, detail="Incorrect code. Please try again.")
    await db.auth_challenges.update_one({"challenge": payload.challenge}, {"$set": {"used": True}})
    user = await db.users.find_one({"_id": ObjectId(ch["user_id"])})
    token = create_access_token(str(user["_id"]), ch["email"])
    return {
        "access_token": token, "token_type": "bearer",
        "user": {"id": str(user["_id"]), "email": ch["email"], "name": user.get("name", "Admin"), "role": user.get("role", "admin")},
    }

@api_router.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin

@api_router.put("/admin/account")
async def update_account(payload: AccountUpdate, admin: dict = Depends(get_current_admin)):
    user = await db.users.find_one({"_id": ObjectId(admin["id"])})
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Your current password is incorrect.")
    updates = {}
    if payload.new_email:
        ne = payload.new_email.lower().strip()
        if ne != user["email"] and await db.users.find_one({"email": ne}):
            raise HTTPException(status_code=400, detail="That email is already in use.")
        updates["email"] = ne
    if payload.new_password:
        if len(payload.new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
        updates["password_hash"] = hash_password(payload.new_password)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    return {"ok": True, "email": updates.get("email", user["email"])}

# ----------------------------------------------------------------------------
# Meta routes
# ----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "My Healthcare Link API"}

@api_router.get("/countries")
async def get_countries():
    return ISLANDS

@api_router.get("/specialties")
async def get_specialties():
    out = set()
    for v in await db.providers.distinct("specialties", {"active": True}):
        if v and str(v).strip():
            out.add(str(v).strip())
    for v in await db.providers.distinct("specialty", {"active": True}):
        for part in split_specialties(v):
            out.add(part)
    return sorted(out)

# Map ISO country codes -> our Caribbean country names (constants.js COUNTRIES keys)
CARIB_ISO = {
    "BB": "Barbados", "JM": "Jamaica", "TT": "Trinidad & Tobago", "LC": "Saint Lucia",
    "BS": "Bahamas", "KY": "Cayman Islands", "GD": "Grenada", "AG": "Antigua & Barbuda",
    "DM": "Dominica", "VC": "Saint Vincent & the Grenadines", "KN": "Saint Kitts & Nevis",
    "GY": "Guyana",
}

@api_router.get("/geo/detect")
async def geo_detect(request: Request):
    ip = client_ip(request)
    if not ip or ip.startswith(("127.", "10.", "192.168.", "172.")) or ip in ("localhost", "testclient", "::1"):
        return {"country": "", "region": "", "city": ""}
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get(f"https://ipapi.co/{ip}/json/", headers={"User-Agent": "MyHealthcareLink/1.0"})
            r.raise_for_status()
            d = r.json()
        code = (d.get("country_code") or "").upper()
        return {"country": CARIB_ISO.get(code, ""), "region": d.get("region") or "", "city": d.get("city") or ""}
    except Exception as e:
        logger.error(f"geo detect failed for {ip}: {e}")
        return {"country": "", "region": "", "city": ""}

@api_router.get("/stats")
async def get_stats():
    providers = await db.providers.count_documents({"active": True})
    articles = await db.articles.count_documents({"published": True})
    events = await db.events.count_documents({"published": True})
    countries = await db.providers.distinct("country", {"active": True})
    countries = [i for i in countries if i]
    return {
        "providers": providers,
        "articles": articles,
        "events": events,
        "countries_covered": len(countries) if countries else len(ISLANDS),
    }

@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"_id": "site"})
    if doc:
        doc.pop("_id", None)
    return doc or {}

@api_router.put("/admin/settings")
async def update_settings(payload: SettingsUpdate, admin: dict = Depends(get_current_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.settings.update_one({"_id": "site"}, {"$set": data}, upsert=True)
    doc = await db.settings.find_one({"_id": "site"})
    doc.pop("_id", None)
    return doc

# ----------------------------------------------------------------------------
# Providers (public)
# ----------------------------------------------------------------------------
@api_router.get("/providers")
async def list_providers(
    country: Optional[str] = None,
    region: Optional[str] = None,
    specialty: Optional[str] = None,
    category: Optional[str] = None,
    accepting: Optional[bool] = None,
    featured: Optional[bool] = None,
    q: Optional[str] = None,
    sort: Optional[str] = "relevant",
    limit: int = 100,
):
    query = {"active": True}
    if country and country != "All Countries":
        query["country"] = country
    apply_region_filter(query, region)
    if specialty:
        query["specialties"] = specialty
    if category:
        query["category"] = category
    if accepting is not None:
        query["accepting_new_patients"] = accepting
    if featured is not None:
        query["featured"] = featured
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [
            {"name": rx}, {"specialty": rx}, {"specialties": rx}, {"description": rx},
            {"category": rx}, {"niches": rx}, {"services": rx},
        ]
    docs = await db.providers.find(query).to_list(limit)
    result = [await enrich_provider(d) for d in docs]
    if sort == "rating":
        result.sort(key=lambda x: x["rating"], reverse=True)
    return result

@api_router.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    doc = await db.providers.find_one({"id": provider_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Provider not found")
    return await enrich_provider(doc)

# Providers (admin)
@api_router.get("/admin/providers")
async def admin_list_providers(admin: dict = Depends(get_current_admin)):
    docs = await db.providers.find({}).to_list(1000)
    return [await enrich_provider(d) for d in docs]

async def geocode_address(query: str):
    q = (query or "").strip()
    if not q:
        return None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "json", "limit": 1},
                headers={"User-Agent": "MyHealthcareLink/1.0 (directory app)"},
            )
            resp.raise_for_status()
            data = resp.json()
        if data:
            return {"latitude": float(data[0]["lat"]), "longitude": float(data[0]["lon"])}
    except Exception as e:
        logger.error(f"Geocode failed for '{q}': {e}")
    return None

def _addr_query(doc: dict) -> str:
    return ", ".join([p for p in [doc.get("address"), doc.get("region"), doc.get("country")] if p])

def split_specialties(value) -> List[str]:
    if not value:
        return []
    seen, out = set(), []
    for p in re.split(r"[;|/]", str(value)):
        n = p.strip()
        if n and n.lower() not in seen:
            seen.add(n.lower())
            out.append(n)
    return out

def _apply_specialties(doc: dict) -> dict:
    lst = split_specialties(doc.get("specialty", ""))
    doc["specialties"] = lst
    if lst:
        doc["specialty"] = lst[0]
    return doc

@api_router.get("/admin/geocode")
async def geocode_lookup(q: str, admin: dict = Depends(get_current_admin)):
    res = await geocode_address(q)
    if not res:
        raise HTTPException(status_code=404, detail="Could not find that address on the map.")
    return res

@api_router.post("/admin/providers")
async def create_provider(payload: ProviderBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    _apply_specialties(doc)
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    if (doc.get("latitude") is None or doc.get("longitude") is None):
        geo = await geocode_address(_addr_query(doc))
        if geo:
            doc.update(geo)
    await db.providers.insert_one(doc)
    return await enrich_provider(doc)

@api_router.put("/admin/providers/{provider_id}")
async def update_provider(provider_id: str, payload: ProviderBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    _apply_specialties(doc)
    if (doc.get("latitude") is None or doc.get("longitude") is None):
        geo = await geocode_address(_addr_query(doc))
        if geo:
            doc.update(geo)
    res = await db.providers.update_one({"id": provider_id}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    doc = await db.providers.find_one({"id": provider_id})
    return await enrich_provider(doc)

@api_router.post("/admin/providers/geocode")
async def backfill_geocode(admin: dict = Depends(get_current_admin)):
    cursor = db.providers.find({
        "$and": [
            {"$or": [{"latitude": None}, {"latitude": {"$exists": False}}]},
            {"address": {"$nin": [None, ""]}},
        ]
    }, {"_id": 0}).limit(40)
    todo = await cursor.to_list(40)
    updated = 0
    for p in todo:
        geo = await geocode_address(_addr_query(p))
        if geo:
            await db.providers.update_one({"id": p["id"]}, {"$set": geo})
            updated += 1
        await asyncio.sleep(1.0)
    remaining = await db.providers.count_documents({
        "$and": [
            {"$or": [{"latitude": None}, {"latitude": {"$exists": False}}]},
            {"address": {"$nin": [None, ""]}},
        ]
    })
    return {"updated": updated, "remaining": remaining}

class BulkIds(BaseModel):
    ids: List[str] = Field(default_factory=list)

@api_router.post("/admin/providers/bulk-delete")
async def bulk_delete_providers(payload: BulkIds, admin: dict = Depends(get_current_admin)):
    ids = [i.strip() for i in payload.ids if i and i.strip()]
    if not ids:
        return {"deleted": 0}
    res = await db.providers.delete_many({"id": {"$in": ids}})
    await db.reviews.delete_many({"provider_id": {"$in": ids}})
    return {"deleted": res.deleted_count}

@api_router.delete("/admin/providers/{provider_id}")
async def delete_provider(provider_id: str, admin: dict = Depends(get_current_admin)):
    await db.providers.delete_one({"id": provider_id})
    await db.reviews.delete_many({"provider_id": provider_id})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Categories
# ----------------------------------------------------------------------------
@api_router.get("/categories")
async def list_categories(type: Optional[str] = None):
    query = {}
    if type:
        query["type"] = type
    docs = await db.categories.find(query, {"_id": 0}).to_list(500)
    return docs

@api_router.get("/admin/categories")
async def admin_list_categories(admin: dict = Depends(get_current_admin)):
    docs = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    for c in docs:
        c["provider_count"] = await db.providers.count_documents({"category": c["name"]})
        c["article_count"] = await db.articles.count_documents({"category": c["name"]})
    return docs

@api_router.post("/admin/categories/sync")
async def sync_categories(admin: dict = Depends(get_current_admin)):
    existing = await db.categories.find({}, {"_id": 0, "name": 1, "type": 1}).to_list(2000)
    have = {((c.get("name") or "").strip().lower(), c.get("type", "")) for c in existing}
    added = 0

    async def add(name, ctype, icon=""):
        nonlocal added
        n = (name or "").strip()
        if not n or (n.lower(), ctype) in have:
            return
        have.add((n.lower(), ctype))
        await db.categories.insert_one({
            "id": new_id(), "name": n, "type": ctype, "icon": icon,
            "description": "", "created_at": now_iso(),
        })
        added += 1

    for c in await db.providers.distinct("category"):
        await add(c, "category")
    specs = set()
    for s in await db.providers.distinct("specialties"):
        if s:
            specs.add(s)
    for s in await db.providers.distinct("specialty"):
        for part in split_specialties(s):
            specs.add(part)
    for s in sorted(specs):
        await add(s, "specialty")
    for nn in await db.providers.distinct("niches"):
        await add(nn, "niche")
    total = await db.categories.count_documents({})
    return {"added": added, "total": total}

@api_router.post("/admin/categories")
async def create_category(payload: CategoryBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/categories/{cid}")
async def update_category(cid: str, payload: CategoryBase, admin: dict = Depends(get_current_admin)):
    res = await db.categories.update_one({"id": cid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    doc = await db.categories.find_one({"id": cid}, {"_id": 0})
    return doc

@api_router.delete("/admin/categories/{cid}")
async def delete_category(cid: str, admin: dict = Depends(get_current_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Services
# ----------------------------------------------------------------------------
@api_router.get("/services")
async def list_services(country: Optional[str] = None, region: Optional[str] = None, q: Optional[str] = None):
    query = {"active": True}
    if country and country != "All Countries":
        query["country"] = country
    apply_region_filter(query, region)
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"name": rx}, {"description": rx}, {"category": rx}]
    docs = await db.services.find(query, {"_id": 0}).to_list(500)
    return docs

@api_router.get("/admin/services")
async def admin_list_services(admin: dict = Depends(get_current_admin)):
    docs = await db.services.find({}, {"_id": 0}).to_list(1000)
    return docs

@api_router.post("/admin/services")
async def create_service(payload: ServiceBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.services.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/services/{sid}")
async def update_service(sid: str, payload: ServiceBase, admin: dict = Depends(get_current_admin)):
    res = await db.services.update_one({"id": sid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    doc = await db.services.find_one({"id": sid}, {"_id": 0})
    return doc

@api_router.delete("/admin/services/{sid}")
async def delete_service(sid: str, admin: dict = Depends(get_current_admin)):
    await db.services.delete_one({"id": sid})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Articles / Blog
# ----------------------------------------------------------------------------
@api_router.get("/articles")
async def list_articles(country: Optional[str] = None, region: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None, limit: int = 100):
    query = {"published": True}
    if country and country != "All Countries":
        query["country"] = country
    apply_region_filter(query, region)
    if category:
        query["category"] = category
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"title": rx}, {"excerpt": rx}, {"content": rx}]
    docs = await db.articles.find(query, {"_id": 0}).sort([("featured", -1), ("created_at", -1)]).to_list(limit)
    return docs

@api_router.get("/articles/categories")
async def article_categories(country: Optional[str] = None, region: Optional[str] = None):
    query = {"published": True, "category": {"$nin": ["", None]}}
    if country and country != "All Countries":
        query["country"] = country
    apply_region_filter(query, region)
    pipeline = [{"$match": query}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$sort": {"count": -1, "_id": 1}}]
    rows = await db.articles.aggregate(pipeline).to_list(200)
    return [{"name": r["_id"], "count": r["count"]} for r in rows]

@api_router.get("/articles/{slug}")
async def get_article(slug: str):
    doc = await db.articles.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not doc:
        doc = await db.articles.find_one({"id": slug, "published": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    return doc

@api_router.get("/admin/articles")
async def admin_list_articles(admin: dict = Depends(get_current_admin)):
    docs = await db.articles.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.post("/admin/articles")
async def create_article(payload: ArticleBase, request: Request, bg: BackgroundTasks, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["slug"] = slugify(payload.title) + "-" + doc["id"][:6]
    doc["created_at"] = now_iso()
    doc["announced"] = bool(doc.get("published"))
    await db.articles.insert_one(doc)
    doc.pop("_id", None)
    if doc.get("published"):
        bg.add_task(_announce, "article", doc, public_base(request))
    return doc

@api_router.put("/admin/articles/{aid}")
async def update_article(aid: str, payload: ArticleBase, request: Request, bg: BackgroundTasks, admin: dict = Depends(get_current_admin)):
    existing = await db.articles.find_one({"id": aid})
    if not existing:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.articles.update_one({"id": aid}, {"$set": payload.model_dump()})
    doc = await db.articles.find_one({"id": aid}, {"_id": 0})
    if doc.get("published") and not existing.get("announced"):
        await db.articles.update_one({"id": aid}, {"$set": {"announced": True}})
        doc["announced"] = True
        bg.add_task(_announce, "article", doc, public_base(request))
    return doc

@api_router.delete("/admin/articles/{aid}")
async def delete_article(aid: str, admin: dict = Depends(get_current_admin)):
    await db.articles.delete_one({"id": aid})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Events
# ----------------------------------------------------------------------------
@api_router.get("/events")
async def list_events(country: Optional[str] = None, region: Optional[str] = None, q: Optional[str] = None, limit: int = 100):
    query = {"published": True}
    if country and country != "All Countries":
        query["country"] = country
    apply_region_filter(query, region)
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"name": rx}, {"description": rx}, {"location": rx}]
    docs = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(limit)
    return docs

@api_router.get("/events/{eid}")
async def get_event(eid: str):
    doc = await db.events.find_one({"id": eid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    return doc

@api_router.get("/admin/events")
async def admin_list_events(admin: dict = Depends(get_current_admin)):
    docs = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(1000)
    return docs

@api_router.post("/admin/events")
async def create_event(payload: EventBase, request: Request, bg: BackgroundTasks, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    doc["announced"] = bool(doc.get("published"))
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    if doc.get("published"):
        bg.add_task(_announce, "event", doc, public_base(request))
    return doc

@api_router.put("/admin/events/{eid}")
async def update_event(eid: str, payload: EventBase, request: Request, bg: BackgroundTasks, admin: dict = Depends(get_current_admin)):
    existing = await db.events.find_one({"id": eid})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.events.update_one({"id": eid}, {"$set": payload.model_dump()})
    doc = await db.events.find_one({"id": eid}, {"_id": 0})
    if doc.get("published") and not existing.get("announced"):
        await db.events.update_one({"id": eid}, {"$set": {"announced": True}})
        doc["announced"] = True
        bg.add_task(_announce, "event", doc, public_base(request))
    return doc

@api_router.delete("/admin/events/{eid}")
async def delete_event(eid: str, admin: dict = Depends(get_current_admin)):
    await db.events.delete_one({"id": eid})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Reviews
# ----------------------------------------------------------------------------
@api_router.get("/reviews")
async def list_reviews(provider_id: Optional[str] = None, limit: int = 100):
    query = {"status": "approved"}
    if provider_id:
        query["provider_id"] = provider_id
    docs = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # attach provider name
    for d in docs:
        p = await db.providers.find_one({"id": d.get("provider_id")}, {"_id": 0, "name": 1})
        d["provider_name"] = p["name"] if p else ""
    return docs

@api_router.post("/reviews")
async def submit_review(payload: ReviewCreate):
    provider = await db.providers.find_one({"id": payload.provider_id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["status"] = "pending"
    doc["created_at"] = now_iso()
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "message": "Thank you! Your review has been submitted and will appear once approved by our team."}

@api_router.get("/admin/reviews")
async def admin_list_reviews(status: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    query = {}
    if status:
        query["status"] = status
    docs = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        p = await db.providers.find_one({"id": d.get("provider_id")}, {"_id": 0, "name": 1})
        d["provider_name"] = p["name"] if p else ""
    return docs

@api_router.put("/admin/reviews/{rid}/status")
async def moderate_review(rid: str, status: str = Query(...), admin: dict = Depends(get_current_admin)):
    if status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.reviews.update_one({"id": rid}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"ok": True}

@api_router.delete("/admin/reviews/{rid}")
async def delete_review(rid: str, admin: dict = Depends(get_current_admin)):
    await db.reviews.delete_one({"id": rid})
    return {"ok": True}

# ----------------------------------------------------------------------------
# File upload & serving
# ----------------------------------------------------------------------------
@api_router.post("/admin/upload")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed (jpg, png, gif, webp).")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 8MB.")
    content_type = file.content_type or MIME_TYPES[ext]
    path = f"{APP_NAME}/providers/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=502, detail="Image upload failed. Please try again.")
    stored = result.get("path", path)
    await db.files.insert_one({
        "id": new_id(), "storage_path": stored, "original_filename": file.filename,
        "content_type": content_type, "created_at": now_iso(),
    })
    return {"path": stored, "url": f"/api/files/{stored}"}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path})
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
    ct = (record.get("content_type") if record else None) or content_type
    return Response(content=data, media_type=ct, headers={"Cache-Control": "public, max-age=86400"})

# ----------------------------------------------------------------------------
# Handover package export (code is exported via GitHub; this bundles data + assets)
# ----------------------------------------------------------------------------
EXPORT_COLLECTIONS = [
    "providers", "services", "categories", "articles", "events", "reviews",
    "subscribers", "quizzes", "quiz_responses", "settings", "campaigns", "files", "searches",
]
ENV_DOCS = [
    ("MONGO_URL", "MongoDB connection string (e.g. mongodb://localhost:27017 or a MongoDB Atlas URI)"),
    ("DB_NAME", "MongoDB database name"),
    ("CORS_ORIGINS", "Comma-separated allowed origins for the frontend (or *)"),
    ("JWT_SECRET", "Long random string used to sign admin login tokens"),
    ("ADMIN_EMAIL", "Email of the first admin account (seeded on first start)"),
    ("ADMIN_PASSWORD", "Password of the first admin account"),
    ("EMERGENT_LLM_KEY", "Emergent universal key — used for object storage (image uploads). Replace storage code if self-hosting outside Emergent."),
    ("EMERGENT_EMAIL_KEY", "Emergent-managed email (Resend) key for 2FA codes, newsletters and campaigns"),
    ("EMAIL_FROM_NAME", "Display name used on outgoing emails"),
    ("VAPID_PUBLIC_KEY", "Web push VAPID public key (generate with `vapid --gen`)"),
    ("VAPID_PRIVATE_KEY", "Web push VAPID private key"),
    ("VAPID_SUBJECT", "mailto: address identifying the push sender"),
    ("REACT_APP_BACKEND_URL", "(frontend/.env) Public URL of the backend, e.g. https://yourdomain.com"),
]

HANDOVER_MD = """# My Healthcare Link — Handover Package

Generated: {generated}

This ZIP contains everything that is NOT in the source-code repository:

| Folder / file | Contents |
|---|---|
| `data/*.json` | One JSON file per database collection ({collections}) |
| `uploads/` | Every image uploaded through the admin panel (provider / article / event photos) |
| `brand/` | Logos, icons, favicons and PWA manifest used by the website |
| `restore_data.py` | Script that re-imports `data/*.json` into a MongoDB database |
| `ENV_VARIABLES.md` | Every environment variable the app needs (names + purpose, no secret values) |

Totals: {counts}

## How to rebuild the site

1. **Source code** — obtain the Git repository (React frontend in `frontend/`, FastAPI backend in `backend/`).
2. **Database** — create a MongoDB database (local or MongoDB Atlas), then run:
   ```
   pip install pymongo
   python restore_data.py "mongodb://localhost:27017" healthlink
   ```
3. **Images** — uploaded images are referenced in the data as `/api/files/<storage_path>`.
   The matching file is in `uploads/` with the same filename as the end of `storage_path`
   (see `data/files.json` for the full mapping). Either keep the Emergent object storage,
   or serve the `uploads/` folder yourself and update `serve_file` in `backend/server.py`.
4. **Environment variables** — create `backend/.env` and `frontend/.env` using `ENV_VARIABLES.md`.
5. **Run**
   ```
   cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8001
   cd frontend && yarn install && yarn start   # or `yarn build` for production
   ```
   All backend routes are served under `/api`; the frontend calls them via `REACT_APP_BACKEND_URL`.
6. Log in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (a 2FA code is emailed).

## Not included (by design)
- Admin passwords and login tokens, 2FA challenges, raw web-push subscriptions, visitor IP logs.
- Secret values of environment variables.
"""

RESTORE_PY = '''import json, sys, glob, os
from pymongo import MongoClient

if len(sys.argv) < 3:
    print("usage: python restore_data.py <MONGO_URL> <DB_NAME>")
    sys.exit(1)
db = MongoClient(sys.argv[1])[sys.argv[2]]
here = os.path.dirname(os.path.abspath(__file__))
for path in sorted(glob.glob(os.path.join(here, "data", "*.json"))):
    name = os.path.splitext(os.path.basename(path))[0]
    docs = json.load(open(path, encoding="utf-8"))
    if name == "settings":
        for d in docs:
            db.settings.replace_one({"_id": d["_id"]}, d, upsert=True)
    elif docs:
        db[name].delete_many({})
        db[name].insert_many(docs)
    print(f"{name}: {len(docs)} documents")
print("done")
'''

def _public_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "frontend" / "public"

@api_router.get("/admin/export/handover")
async def export_handover(admin: dict = Depends(get_current_admin)):
    import zipfile
    buf = io.BytesIO()
    counts = {}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name in EXPORT_COLLECTIONS:
            proj = {"_id": 0} if name != "settings" else None
            docs = await db[name].find({}, proj).to_list(100000)
            if name == "subscribers":
                for d in docs:
                    d.pop("push_subscription", None)
            counts[name] = len(docs)
            z.writestr(f"data/{name}.json", json.dumps(docs, indent=1, default=str, ensure_ascii=False))

        files = await db.files.find({}, {"_id": 0}).to_list(10000)
        paths = [f["storage_path"] for f in files if f.get("storage_path")]

        async def fetch(sp):
            try:
                data, _ = await asyncio.to_thread(get_object, sp)
                return sp, data
            except Exception as e:
                logger.warning(f"handover: could not fetch {sp}: {e}")
                return sp, None

        fetched = 0
        for sp, data in await asyncio.gather(*(fetch(p) for p in paths)):
            if data is not None:
                z.writestr(f"uploads/{sp.rsplit('/', 1)[-1]}", data)
                fetched += 1
        counts["uploaded_images"] = fetched

        pub = _public_dir()
        if pub.exists():
            for p in pub.iterdir():
                if p.suffix.lower() in (".png", ".ico", ".svg", ".jpg", ".jpeg", ".webp", ".json") and p.is_file():
                    z.write(p, f"brand/{p.name}")

        z.writestr("ENV_VARIABLES.md", "# Environment variables\n\n| Name | Purpose |\n|---|---|\n" +
                   "\n".join(f"| `{k}` | {v} |" for k, v in ENV_DOCS) + "\n")
        z.writestr("restore_data.py", RESTORE_PY)
        z.writestr("HANDOVER.md", HANDOVER_MD.format(
            generated=now_iso(), collections=", ".join(EXPORT_COLLECTIONS),
            counts=", ".join(f"{k}: {v}" for k, v in counts.items()),
        ))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(content=buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="healthlink-handover-{stamp}.zip"'})

@api_router.post("/admin/providers/bulk")
async def bulk_import_providers(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    bool_fields = {"in_network", "featured", "verified", "accepting_new_patients", "active"}
    list_fields = {"niches", "services"}
    float_fields = {"latitude", "longitude"}
    valid_keys = set(ProviderBase(name="x").model_dump().keys())
    created = 0
    errors = []
    for idx, row in enumerate(reader, start=2):
        name = (row.get("name") or "").strip()
        if not name:
            errors.append(f"Row {idx}: missing name — skipped")
            continue
        doc = ProviderBase(name=name).model_dump()
        for k, raw_val in row.items():
            if k not in valid_keys or raw_val is None:
                continue
            val = str(raw_val).strip()
            if k in bool_fields:
                doc[k] = val.lower() in ("true", "yes", "1", "y")
            elif k in list_fields:
                doc[k] = [x.strip() for x in re.split(r"[;|]", val) if x.strip()]
            elif k in float_fields:
                try:
                    doc[k] = float(val) if val else None
                except ValueError:
                    doc[k] = None
            else:
                doc[k] = val
        doc["name"] = name
        _apply_specialties(doc)
        doc["id"] = new_id()
        doc["created_at"] = now_iso()
        await db.providers.insert_one(doc)
        created += 1
    return {"created": created, "errors": errors}

# ----------------------------------------------------------------------------
# Startup
# ----------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"role": "admin"})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrator",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user {admin_email}")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.providers.create_index("id", unique=True)
    await db.reviews.create_index("provider_id")
    await db.subscribers.create_index("email", unique=True)
    await db.visits.create_index("session_id")
    await db.visits.create_index("ts")
    await db.quiz_responses.create_index("quiz_id")
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.campaign_recipients.create_index("token", unique=True)
    await db.campaigns.create_index("ref_id")
    try:
        await db.auth_challenges.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass
    async for p in db.providers.find({"specialties": {"$exists": False}}, {"specialty": 1}):
        lst = split_specialties(p.get("specialty", ""))
        upd = {"specialties": lst}
        if lst:
            upd["specialty"] = lst[0]
        await db.providers.update_one({"_id": p["_id"]}, {"$set": upd})
    if await db.categories.count_documents({}) == 0:
        for n in ["Specialty", "General Practitioner", "Hospital", "Clinic", "Pediatrics"]:
            await db.categories.insert_one({
                "id": new_id(), "name": n, "type": "category", "icon": "",
                "description": "", "created_at": now_iso(),
            })
        logger.info("Seeded default categories")
    for coll in ("providers", "articles", "events", "reviews", "services"):
        try:
            await db[coll].update_many({"island": {"$exists": True}}, {"$rename": {"island": "country"}})
        except Exception as e:
            logger.error(f"Migration island->country on {coll} failed: {e}")
    await seed_admin()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

# ----------------------------------------------------------------------------
# Visitor analytics
# ----------------------------------------------------------------------------
class TrackInput(BaseModel):
    session_id: str
    path: str
    referrer: Optional[str] = ""

class DurationInput(BaseModel):
    visit_id: str
    duration: float

@api_router.post("/track")
async def track_visit(payload: TrackInput, request: Request, bg: BackgroundTasks):
    ip = client_ip(request)
    vid = new_id()
    await db.visits.insert_one({
        "id": vid, "session_id": payload.session_id, "path": payload.path,
        "referrer": payload.referrer or "", "ip": ip,
        "country": "", "city": "",
        "user_agent": request.headers.get("user-agent", ""),
        "ts": now_iso(), "duration": 0,
    })
    bg.add_task(_geolocate_visit, vid, ip)
    return {"visit_id": vid}

async def _geolocate_visit(visit_id: str, ip: str):
    geo = await geolocate_ip(ip)
    if geo["country"] or geo["city"]:
        await db.visits.update_one({"id": visit_id}, {"$set": {"country": geo["country"], "city": geo["city"]}})

@api_router.post("/track/duration")
async def track_duration(payload: DurationInput):
    await db.visits.update_one({"id": payload.visit_id}, {"$set": {"duration": round(payload.duration)}})
    return {"ok": True}

class SearchTrackInput(BaseModel):
    q: str
    country: Optional[str] = ""
    region: Optional[str] = ""
    results: int = 0

@api_router.post("/search/track")
async def track_search(payload: SearchTrackInput):
    term = payload.q.strip()[:100]
    if len(term) < 2:
        return {"ok": False}
    await db.searches.insert_one({
        "id": new_id(), "term": term, "term_key": term.lower(),
        "country": payload.country or "", "region": payload.region or "",
        "results": max(0, payload.results), "ts": now_iso(),
    })
    return {"ok": True}

@api_router.get("/admin/search-gaps")
async def search_gaps(start: Optional[str] = None, end: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    sq = {}
    if start:
        sq.setdefault("ts", {})["$gte"] = start
    if end:
        sq.setdefault("ts", {})["$lte"] = end + "T23:59:59.999999"
    pipeline = [
        {"$match": sq},
        {"$group": {
            "_id": "$term_key", "term": {"$last": "$term"}, "count": {"$sum": 1},
            "zero_results": {"$sum": {"$cond": [{"$eq": ["$results", 0]}, 1, 0]}},
            "last_searched": {"$max": "$ts"}, "countries": {"$addToSet": "$country"},
        }},
        {"$sort": {"zero_results": -1, "count": -1}},
        {"$limit": 300},
    ]
    rows = await db.searches.aggregate(pipeline).to_list(300)
    total = await db.searches.count_documents(sq)
    zero = await db.searches.count_documents({**sq, "results": 0})
    return {
        "total_searches": total, "zero_result_searches": zero,
        "terms": [{
            "term": r["term"], "count": r["count"], "zero_results": r["zero_results"],
            "last_searched": r["last_searched"], "countries": [c for c in r["countries"] if c],
        } for r in rows],
    }

@api_router.delete("/admin/search-gaps")
async def clear_search_gaps(admin: dict = Depends(get_current_admin)):
    await db.searches.delete_many({})
    return {"ok": True}

@api_router.get("/admin/analytics")
async def analytics(start: Optional[str] = None, end: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    vq = {}
    if start:
        vq.setdefault("ts", {})["$gte"] = start
    if end:
        vq.setdefault("ts", {})["$lte"] = end + "T23:59:59.999999"
    visits = await db.visits.find(vq, {"_id": 0}).sort("ts", -1).limit(3000).to_list(3000)
    sessions = {}
    for v in visits:
        s = sessions.get(v["session_id"])
        if not s:
            s = sessions[v["session_id"]] = {
                "session_id": v["session_id"], "ip": v.get("ip", ""),
                "country": v.get("country", ""), "city": v.get("city", ""),
                "user_agent": v.get("user_agent", ""),
                "first_seen": v["ts"], "last_seen": v["ts"],
                "total_duration": 0, "pages": [],
            }
        s["first_seen"] = min(s["first_seen"], v["ts"])
        s["last_seen"] = max(s["last_seen"], v["ts"])
        s["total_duration"] += v.get("duration", 0) or 0
        if not s["country"] and v.get("country"):
            s["country"] = v["country"]
        if not s["city"] and v.get("city"):
            s["city"] = v["city"]
        s["pages"].append({"path": v["path"], "ts": v["ts"], "duration": v.get("duration", 0) or 0})
    out = sorted(sessions.values(), key=lambda x: x["last_seen"], reverse=True)
    for s in out:
        s["page_count"] = len(s["pages"])
        s["pages"].sort(key=lambda p: p["ts"])
    total = await db.visits.count_documents({})
    return {"sessions": out[:200], "total_sessions": len(sessions), "total_pageviews": total}

# ----------------------------------------------------------------------------
# Newsletter subscribers
# ----------------------------------------------------------------------------
class SubscribeInput(BaseModel):
    email: EmailStr

class SubscriberActive(BaseModel):
    active: bool

def _welcome_html(unsub: str) -> str:
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;background:#FAF7F2">'
            f'<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">'
            f'<h1 style="color:#0B132B;margin:0 0 8px;font-size:22px">Welcome to {escape(EMAIL_FROM_NAME)}</h1>'
            f'<p style="color:#334155;font-size:15px;line-height:1.6">Thanks for joining our mailing list! '
            f'You\'ll be the first to know whenever we publish a new health article or add a healthcare event across the Caribbean.</p>'
            f'<p style="color:#334155;font-size:15px;line-height:1.6">Stay well,<br>The {escape(EMAIL_FROM_NAME)} team</p>'
            f'<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
            f'<p style="font-size:12px;color:#94a3b8">You are receiving this because you subscribed to updates from '
            f'{escape(EMAIL_FROM_NAME)}. <a href="{escape(unsub)}" style="color:#94a3b8">Unsubscribe</a>.</p>'
            f'</div></td></tr></table>')

async def _send_welcome(email: str, token: str, base: str):
    unsub = f"{base}/api/newsletter/unsubscribe?token={token}"
    try:
        await send_email(to=email, subject=f"Welcome to {EMAIL_FROM_NAME}", html=_welcome_html(unsub))
    except Exception as e:
        logger.error(f"Welcome email to {email} failed: {e}")

@api_router.post("/subscribe")
async def subscribe(payload: SubscribeInput, request: Request, bg: BackgroundTasks):
    email = payload.email.lower().strip()
    base = public_base(request)
    existing = await db.subscribers.find_one({"email": email})
    if existing:
        if not existing.get("active"):
            await db.subscribers.update_one({"email": email}, {"$set": {"active": True}})
            bg.add_task(_send_welcome, email, existing["unsubscribe_token"], base)
        return {"ok": True, "message": "You're on the list!"}
    token = secrets.token_urlsafe(24)
    await db.subscribers.insert_one({
        "id": new_id(), "email": email, "active": True,
        "unsubscribe_token": token, "created_at": now_iso(),
    })
    bg.add_task(_send_welcome, email, token, base)
    return {"ok": True, "message": "You're subscribed!"}

@api_router.get("/admin/subscribers")
async def list_subscribers(admin: dict = Depends(get_current_admin)):
    return await db.subscribers.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)

@api_router.post("/admin/subscribers")
async def add_subscriber(payload: SubscribeInput, admin: dict = Depends(get_current_admin)):
    email = payload.email.lower().strip()
    if await db.subscribers.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="That email is already on the list.")
    doc = {"id": new_id(), "email": email, "active": True,
           "unsubscribe_token": secrets.token_urlsafe(24), "created_at": now_iso()}
    await db.subscribers.insert_one(dict(doc))
    return doc

@api_router.put("/admin/subscribers/{sid}")
async def update_subscriber(sid: str, payload: SubscriberActive, admin: dict = Depends(get_current_admin)):
    res = await db.subscribers.update_one({"id": sid}, {"$set": {"active": payload.active}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return {"ok": True}

@api_router.delete("/admin/subscribers/{sid}")
async def delete_subscriber(sid: str, admin: dict = Depends(get_current_admin)):
    await db.subscribers.delete_one({"id": sid})
    return {"ok": True}

async def _send_newsletter(kind: str, doc: dict, base: str, campaign_id: str = ""):
    subs = await db.subscribers.find({"active": True}, {"_id": 0}).to_list(5000)
    if kind == "article":
        heading = "New article on My Healthcare Link"
        title = doc.get("title", "")
        summary = doc.get("excerpt", "")
        link = f"{base}/blog/{doc.get('slug', '')}"
    else:
        heading = "New event on My Healthcare Link"
        title = doc.get("name", "")
        summary = doc.get("description", "")
        link = f"{base}/events/{doc.get('id', '')}"
    sent = 0
    for s in subs:
        unsub = f"{base}/api/newsletter/unsubscribe?token={s['unsubscribe_token']}"
        pixel = tracked = ""
        token = secrets.token_urlsafe(16)
        if campaign_id:
            tracked = f"{base}/api/track/click/{token}"
            pixel = f"{base}/api/track/open/{token}.gif"
        try:
            await send_email(to=s["email"], subject=f"{heading}: {title}",
                             html=_newsletter_html(heading, title, summary, tracked or link, unsub, pixel))
            if campaign_id:
                await db.campaign_recipients.insert_one({
                    "token": token, "campaign_id": campaign_id, "channel": "email",
                    "email": s["email"], "opened": False, "clicked": False, "created_at": now_iso(),
                })
            sent += 1
        except Exception as e:
            logger.error(f"Newsletter send to {s['email']} failed: {e}")
        await asyncio.sleep(0.4)
    if campaign_id:
        await db.campaigns.update_one({"id": campaign_id}, {"$inc": {"email_sent": sent}})

@api_router.post("/admin/articles/{aid}/notify")
async def notify_article(aid: str, request: Request, bg: BackgroundTasks, admin: dict = Depends(get_current_admin)):
    doc = await db.articles.find_one({"id": aid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    count = await db.subscribers.count_documents({"active": True})
    bg.add_task(_announce, "article", doc, public_base(request))
    return {"ok": True, "queued": count}

@api_router.post("/admin/events/{eid}/notify")
async def notify_event(eid: str, request: Request, bg: BackgroundTasks, admin: dict = Depends(get_current_admin)):
    doc = await db.events.find_one({"id": eid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    count = await db.subscribers.count_documents({"active": True})
    bg.add_task(_announce, "event", doc, public_base(request))
    return {"ok": True, "queued": count}

@api_router.get("/newsletter/unsubscribe")
async def newsletter_unsubscribe(token: str):
    res = await db.subscribers.update_one({"unsubscribe_token": token}, {"$set": {"active": False}})
    ok = res.matched_count > 0
    msg = ("You've been unsubscribed. You won't receive further emails from us."
           if ok else "This unsubscribe link is invalid or has already been used.")
    html = (f'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>Unsubscribe</title></head>'
            f'<body style="font-family:Arial,sans-serif;background:#FAF7F2;padding:60px 20px;text-align:center">'
            f'<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px">'
            f'<h1 style="color:#0B132B">My Healthcare Link</h1>'
            f'<p style="color:#334155;font-size:16px">{escape(msg)}</p></div></body></html>')
    return HTMLResponse(content=html)

# ----------------------------------------------------------------------------
# Web Push notifications + campaign open/click tracking
# ----------------------------------------------------------------------------
# 1x1 transparent GIF used as the email open-tracking pixel.
_PIXEL = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

class PushSubscribeInput(BaseModel):
    subscription: Dict[str, Any]
    email: Optional[str] = None

class PushUnsubscribeInput(BaseModel):
    endpoint: str

@api_router.get("/push/vapid-public-key")
async def push_vapid_public_key():
    return {"public_key": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def push_subscribe(payload: PushSubscribeInput):
    sub = payload.subscription or {}
    endpoint = sub.get("endpoint")
    if not endpoint or not sub.get("keys"):
        raise HTTPException(status_code=400, detail="Invalid push subscription")
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {"endpoint": endpoint, "keys": sub["keys"],
                  "email": (payload.email or "").lower().strip() or None},
         "$setOnInsert": {"id": new_id(), "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}

@api_router.post("/push/unsubscribe")
async def push_unsubscribe(payload: PushUnsubscribeInput):
    await db.push_subscriptions.delete_one({"endpoint": payload.endpoint})
    return {"ok": True}

@api_router.get("/track/open/{token}.gif")
async def track_open(token: str):
    r = await db.campaign_recipients.find_one({"token": token})
    if r and not r.get("opened"):
        await db.campaign_recipients.update_one({"token": token}, {"$set": {"opened": True, "opened_at": now_iso()}})
        await db.campaigns.update_one({"id": r["campaign_id"]}, {"$inc": {"email_opened": 1}})
    return Response(content=_PIXEL, media_type="image/gif", headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

@api_router.get("/track/click/{token}")
async def track_click(token: str):
    r = await db.campaign_recipients.find_one({"token": token})
    if not r:
        raise HTTPException(status_code=404, detail="This link is no longer valid.")
    if not r.get("clicked"):
        await db.campaign_recipients.update_one({"token": token}, {"$set": {"clicked": True, "clicked_at": now_iso()}})
        field = "push_clicked" if r.get("channel") == "push" else "email_clicked"
        await db.campaigns.update_one({"id": r["campaign_id"]}, {"$inc": {field: 1}})
        # A click implies the message was opened, even if the pixel was blocked.
        if r.get("channel") == "email" and not r.get("opened"):
            await db.campaign_recipients.update_one({"token": token}, {"$set": {"opened": True, "opened_at": now_iso()}})
            await db.campaigns.update_one({"id": r["campaign_id"]}, {"$inc": {"email_opened": 1}})
    camp = await db.campaigns.find_one({"id": r["campaign_id"]}, {"_id": 0})
    return RedirectResponse(url=(camp or {}).get("link", "/"), status_code=302)

def _webpush_send(sub: dict, payload: str):
    """Returns True on success, None if the subscription is gone (delete it), False on other errors."""
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            return None
        logger.error(f"Push send failed: {e}")
        return False
    except Exception as e:
        logger.error(f"Push send error: {e}")
        return False

async def _send_push(kind: str, doc: dict, base: str, campaign_id: str):
    if not VAPID_PRIVATE_KEY:
        return
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(20000)
    if not subs:
        return
    if kind == "article":
        body = doc.get("title", "")
        link = f"{base}/blog/{doc.get('slug', '')}"
        heading = "New article"
    else:
        body = doc.get("name", "")
        link = f"{base}/events/{doc.get('id', '')}"
        heading = "New event"
    sent = 0
    for sub in subs:
        token = secrets.token_urlsafe(16)
        payload = json.dumps({
            "title": f"{heading} · {EMAIL_FROM_NAME}",
            "body": body,
            "url": f"{base}/api/track/click/{token}",
            "icon": "/icon-192.png",
            "badge": "/icon-192.png",
        })
        result = await asyncio.to_thread(_webpush_send, sub, payload)
        if result is None:
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
        elif result:
            await db.campaign_recipients.insert_one({
                "token": token, "campaign_id": campaign_id, "channel": "push",
                "email": sub.get("email"), "opened": False, "clicked": False, "created_at": now_iso(),
            })
            sent += 1
    if sent:
        await db.campaigns.update_one({"id": campaign_id}, {"$inc": {"push_sent": sent}})

async def _announce(kind: str, doc: dict, base: str):
    """Create a tracked campaign, then dispatch email + web push for a new article/event."""
    if kind == "article":
        title = doc.get("title", "")
        link = f"{base}/blog/{doc.get('slug', '')}"
    else:
        title = doc.get("name", "")
        link = f"{base}/events/{doc.get('id', '')}"
    campaign = {
        "id": new_id(), "kind": kind, "ref_id": doc.get("id"), "title": title, "link": link,
        "created_at": now_iso(),
        "email_sent": 0, "email_opened": 0, "email_clicked": 0,
        "push_sent": 0, "push_clicked": 0,
    }
    await db.campaigns.insert_one(dict(campaign))
    cid = campaign["id"]
    try:
        await _send_newsletter(kind, doc, base, cid)
    except Exception as e:
        logger.error(f"Announce email dispatch failed: {e}")
    try:
        await _send_push(kind, doc, base, cid)
    except Exception as e:
        logger.error(f"Announce push dispatch failed: {e}")

@api_router.get("/admin/campaigns")
async def list_campaigns(admin: dict = Depends(get_current_admin)):
    docs = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs

@api_router.get("/admin/push/count")
async def push_count(admin: dict = Depends(get_current_admin)):
    return {"count": await db.push_subscriptions.count_documents({})}

# ----------------------------------------------------------------------------
# About page
# ----------------------------------------------------------------------------
class TeamMember(BaseModel):
    name: str = ""
    role: Optional[str] = ""
    photo: Optional[str] = ""
    bio: Optional[str] = ""

class AboutContent(BaseModel):
    heading: Optional[str] = ""
    story: Optional[str] = ""
    image_url: Optional[str] = ""
    team: List[TeamMember] = Field(default_factory=list)

@api_router.get("/about")
async def get_about():
    doc = await db.settings.find_one({"_id": "about"})
    if doc:
        doc.pop("_id", None)
    return doc or {}

@api_router.put("/admin/about")
async def update_about(payload: AboutContent, admin: dict = Depends(get_current_admin)):
    data = payload.model_dump()
    await db.settings.update_one({"_id": "about"}, {"$set": data}, upsert=True)
    return data

# ----------------------------------------------------------------------------
# Quizzes
# ----------------------------------------------------------------------------
class QuizOption(BaseModel):
    text: str = ""
    points: int = 0

class ResultTier(BaseModel):
    min_points: int = 0
    message: str = ""

class QuizQuestion(BaseModel):
    id: Optional[str] = None
    text: str
    options: List[QuizOption] = Field(default_factory=list)

class QuizBase(BaseModel):
    title: str
    description: Optional[str] = ""
    result_message: Optional[str] = ""
    result_tiers: List[ResultTier] = Field(default_factory=list)
    popup_delay_seconds: int = 10
    active: bool = False
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    questions: List[QuizQuestion] = Field(default_factory=list)

class QuizAnswer(BaseModel):
    question_id: Optional[str] = None
    question: Optional[str] = ""
    answer: str = ""

class QuizSubmit(BaseModel):
    quiz_id: str
    name: str
    email: EmailStr
    age: Optional[str] = ""
    answers: List[QuizAnswer] = Field(default_factory=list)

def _opt_text(o) -> str:
    return o if isinstance(o, str) else (o.get("text", "") if isinstance(o, dict) else "")

def _opt_points(o) -> int:
    return 0 if isinstance(o, str) else int((o.get("points") if isinstance(o, dict) else 0) or 0)

def _tier_message(quiz: dict, total: int) -> str:
    tiers = sorted(quiz.get("result_tiers") or [], key=lambda t: (t.get("min_points") or 0))
    chosen = None
    for t in tiers:
        if total >= (t.get("min_points") or 0):
            chosen = t
    if chosen and (chosen.get("message") or "").strip():
        return chosen["message"]
    return quiz.get("result_message", "")

def _md_bold(text: str) -> str:
    safe = escape(text or "")
    safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe)
    return safe.replace("\n", "<br>")

def _public_quiz(q: dict) -> dict:
    return {
        "id": q["id"], "title": q.get("title", ""), "description": q.get("description", ""),
        "popup_delay_seconds": q.get("popup_delay_seconds", 10),
        "questions": [{"id": x.get("id"), "text": x.get("text", ""),
                       "options": [_opt_text(o) for o in x.get("options", [])]}
                      for x in q.get("questions", [])],
    }

def _assign_question_ids(questions) -> List[dict]:
    out = []
    for x in questions:
        d = x.model_dump() if hasattr(x, "model_dump") else dict(x)
        if not d.get("id"):
            d["id"] = new_id()
        out.append(d)
    return out

async def _upsert_subscriber(email: str, base: str) -> str:
    email = email.lower().strip()
    existing = await db.subscribers.find_one({"email": email})
    if existing:
        if not existing.get("active"):
            await db.subscribers.update_one({"email": email}, {"$set": {"active": True}})
        return existing.get("unsubscribe_token", "")
    token = secrets.token_urlsafe(24)
    await db.subscribers.insert_one({
        "id": new_id(), "email": email, "active": True,
        "unsubscribe_token": token, "created_at": now_iso(),
    })
    return token

def _quiz_result_html(name: str, message: str, answers: list, points: int, unsub: str) -> str:
    rows = "".join(
        f'<tr><td style="padding:8px 12px 8px 0;color:#0F172A;font-weight:600;vertical-align:top;border-bottom:1px solid #F1E7E4">{escape(a.get("question") or "")}</td>'
        f'<td style="padding:8px 0;color:#334155;border-bottom:1px solid #F1E7E4">{escape(a.get("answer") or "")}</td></tr>'
        for a in answers
    )
    msg_block = (f'<div style="background:#FDF7E7;border-left:4px solid #D4AF37;border-radius:10px;padding:16px 18px;margin:8px 0 4px">'
                 f'<p style="color:#334155;font-size:16px;line-height:1.7;margin:0">{_md_bold(message)}</p></div>') if message else ""
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;background:#FAF7F2">'
            f'<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(11,19,43,0.08)">'
            f'<div style="background:linear-gradient(135deg,#E89D93 0%,#D4AF37 100%);padding:28px 32px;text-align:center">'
            f'<p style="color:#fff;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;opacity:.9">{escape(EMAIL_FROM_NAME)}</p>'
            f'<h1 style="color:#fff;margin:0;font-size:26px">Thanks, {escape(name or "there")}!</h1>'
            f'<div style="display:inline-block;margin-top:12px;background:rgba(255,255,255,.9);color:#0B132B;font-weight:bold;font-size:14px;padding:6px 16px;border-radius:999px">You scored {points} point{"s" if points != 1 else ""}</div>'
            f'</div>'
            f'<div style="padding:28px 32px">'
            f'{msg_block}'
            f'<h3 style="color:#0F172A;font-size:15px;margin:22px 0 6px">Your answers</h3>'
            f'<table style="width:100%;border-collapse:collapse;font-size:14px">{rows}</table>'
            f'<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
            f'<p style="font-size:12px;color:#94a3b8">You are receiving this because you completed a quiz and subscribed to updates from '
            f'{escape(EMAIL_FROM_NAME)}. <a href="{escape(unsub)}" style="color:#94a3b8">Unsubscribe</a>.</p>'
            f'</div></div></td></tr></table>')

async def _send_quiz_result(email, name, message, answers, points, token, base):
    unsub = f"{base}/api/newsletter/unsubscribe?token={token}"
    try:
        await send_email(to=email, subject=f"Your {EMAIL_FROM_NAME} quiz results",
                         html=_quiz_result_html(name, message, answers, points, unsub))
    except Exception as e:
        logger.error(f"Quiz result email to {email} failed: {e}")

@api_router.get("/quiz/active")
async def active_quiz():
    q = await db.quizzes.find_one({"active": True}, {"_id": 0})
    if not q:
        return None
    today = datetime.now(timezone.utc).date().isoformat()
    if q.get("start_date") and today < q["start_date"]:
        return None
    if q.get("end_date") and today > q["end_date"]:
        return None
    return _public_quiz(q)

@api_router.post("/quiz/submit")
async def submit_quiz(payload: QuizSubmit, request: Request, bg: BackgroundTasks):
    quiz = await db.quizzes.find_one({"id": payload.quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    email = payload.email.lower().strip()
    base = public_base(request)
    token = await _upsert_subscriber(email, base)
    qmap = {x.get("id"): x.get("text", "") for x in quiz.get("questions", [])}
    qopts = {x.get("id"): x.get("options", []) for x in quiz.get("questions", [])}
    answers, total = [], 0
    for a in payload.answers:
        if a.question_id not in qmap:
            continue
        answers.append({"question_id": a.question_id, "question": qmap[a.question_id], "answer": a.answer})
        for o in qopts.get(a.question_id, []):
            if _opt_text(o) == a.answer:
                total += _opt_points(o)
    message = _tier_message(quiz, total)
    await db.quiz_responses.insert_one({
        "id": new_id(), "quiz_id": payload.quiz_id, "quiz_title": quiz.get("title", ""),
        "name": payload.name.strip(), "email": email, "age": (payload.age or "").strip(),
        "answers": answers, "points": total, "created_at": now_iso(),
    })
    bg.add_task(_send_quiz_result, email, payload.name.strip(), message, answers, total, token, base)
    max_points = sum(max([_opt_points(o) for o in x.get("options", [])] or [0]) for x in quiz.get("questions", []))
    return {"ok": True, "message": "Thanks for completing the quiz! Check your inbox for your results.",
            "points": total, "max_points": max_points, "result_message": message}

@api_router.get("/admin/quizzes")
async def list_quizzes(admin: dict = Depends(get_current_admin)):
    quizzes = await db.quizzes.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for q in quizzes:
        q["response_count"] = await db.quiz_responses.count_documents({"quiz_id": q["id"]})
    return quizzes

@api_router.post("/admin/quizzes")
async def create_quiz(payload: QuizBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    doc["questions"] = _assign_question_ids(payload.questions)
    if doc.get("active"):
        await db.quizzes.update_many({}, {"$set": {"active": False}})
    await db.quizzes.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/quizzes/{qid}")
async def update_quiz(qid: str, payload: QuizBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["questions"] = _assign_question_ids(payload.questions)
    if doc.get("active"):
        await db.quizzes.update_many({"id": {"$ne": qid}}, {"$set": {"active": False}})
    res = await db.quizzes.update_one({"id": qid}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return await db.quizzes.find_one({"id": qid}, {"_id": 0})

@api_router.delete("/admin/quizzes/{qid}")
async def delete_quiz(qid: str, admin: dict = Depends(get_current_admin)):
    await db.quizzes.delete_one({"id": qid})
    return {"ok": True}

@api_router.get("/admin/quizzes/{qid}/analysis")
async def quiz_analysis(qid: str, start: Optional[str] = None, end: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    quiz = await db.quizzes.find_one({"id": qid}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    rq = {"quiz_id": qid}
    if start:
        rq.setdefault("created_at", {})["$gte"] = start
    if end:
        rq.setdefault("created_at", {})["$lte"] = end + "T23:59:59.999999"
    responses = await db.quiz_responses.find(rq, {"_id": 0}).sort("created_at", -1).to_list(5000)
    questions = []
    for ques in quiz.get("questions", []):
        opts = [_opt_text(o) for o in ques.get("options", [])]
        counts = {opt: 0 for opt in opts}
        for r in responses:
            for a in r.get("answers", []):
                if a.get("question_id") == ques.get("id") or a.get("question") == ques.get("text"):
                    counts[a.get("answer")] = counts.get(a.get("answer"), 0) + 1
        questions.append({"id": ques.get("id"), "text": ques.get("text"), "counts": counts})
    ages = {}
    for r in responses:
        a = (r.get("age") or "Unknown").strip() or "Unknown"
        ages[a] = ages.get(a, 0) + 1
    return {
        "quiz_title": quiz.get("title", ""),
        "total": len(responses),
        "questions": questions,
        "ages": ages,
        "responses": [{"name": r.get("name"), "email": r.get("email"), "age": r.get("age"),
                       "points": r.get("points", 0),
                       "answers": r.get("answers", []), "created_at": r.get("created_at")} for r in responses],
    }

@api_router.get("/admin/quizzes/{qid}/responses.csv")
async def export_quiz_csv(qid: str, admin: dict = Depends(get_current_admin)):
    quiz = await db.quizzes.find_one({"id": qid}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    responses = await db.quiz_responses.find({"quiz_id": qid}, {"_id": 0}).sort("created_at", 1).to_list(20000)
    questions = quiz.get("questions", [])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "Name", "Email", "Age", "Points"] + [q.get("text", "") for q in questions])
    for r in responses:
        amap = {a.get("question_id"): a.get("answer", "") for a in r.get("answers", [])}
        row = [r.get("created_at", ""), r.get("name", ""), r.get("email", ""), r.get("age", ""), r.get("points", "")]
        row += [amap.get(q.get("id"), "") for q in questions]
        w.writerow(row)
    fname = re.sub(r"[^a-z0-9]+", "-", (quiz.get("title") or "quiz").lower()).strip("-") or "quiz"
    return Response(content="\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{fname}-responses.csv"'})

@api_router.get("/regions/counts")
async def region_counts(country: str):
    pipeline = [{"$match": {"active": True, "country": country}},
                {"$group": {"_id": "$region", "count": {"$sum": 1}}}]
    out = {}
    async for row in db.providers.aggregate(pipeline):
        if row.get("_id"):
            out[row["_id"]] = row["count"]
    return out

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

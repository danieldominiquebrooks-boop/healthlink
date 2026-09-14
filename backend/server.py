from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query, UploadFile, File
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
import logging
import jwt
import bcrypt
import re
import csv
import io
import requests
from datetime import datetime, timezone, timedelta
from bson import ObjectId

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
    category: Optional[str] = ""
    niches: List[str] = Field(default_factory=list)
    description: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    address: Optional[str] = ""
    island: Optional[str] = ""
    country: Optional[str] = ""
    image_url: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
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
    island: Optional[str] = ""
    icon: Optional[str] = "activity"
    active: bool = True

class ArticleBase(BaseModel):
    title: str
    excerpt: Optional[str] = ""
    content: Optional[str] = ""
    category: Optional[str] = ""
    island: Optional[str] = ""
    image_url: Optional[str] = ""
    author: Optional[str] = "My Healthcare Link"
    published: bool = True

class EventBase(BaseModel):
    name: str
    date: Optional[str] = ""
    time: Optional[str] = ""
    location: Optional[str] = ""
    island: Optional[str] = ""
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
    island: Optional[str] = ""
    verified_patient: bool = False

class SettingsUpdate(BaseModel):
    site_title: Optional[str] = None
    hero_heading: Optional[str] = None
    hero_subheading: Optional[str] = None
    about_text: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

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
@api_router.post("/auth/login")
async def login(payload: LoginInput):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user["_id"]), "email": email, "name": user.get("name", "Admin"), "role": user.get("role", "admin")},
    }

@api_router.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin

# ----------------------------------------------------------------------------
# Meta routes
# ----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "My Healthcare Link API"}

@api_router.get("/islands")
async def get_islands():
    return ISLANDS

@api_router.get("/stats")
async def get_stats():
    providers = await db.providers.count_documents({"active": True})
    articles = await db.articles.count_documents({"published": True})
    events = await db.events.count_documents({"published": True})
    islands = await db.providers.distinct("island", {"active": True})
    islands = [i for i in islands if i]
    return {
        "providers": providers,
        "articles": articles,
        "events": events,
        "islands_covered": len(islands) if islands else len(ISLANDS),
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
    island: Optional[str] = None,
    specialty: Optional[str] = None,
    category: Optional[str] = None,
    in_network: Optional[bool] = None,
    accepting: Optional[bool] = None,
    featured: Optional[bool] = None,
    q: Optional[str] = None,
    sort: Optional[str] = "relevant",
    limit: int = 100,
):
    query = {"active": True}
    if island and island != "All Islands":
        query["island"] = island
    if specialty:
        query["specialty"] = specialty
    if category:
        query["category"] = category
    if in_network is not None:
        query["in_network"] = in_network
    if accepting is not None:
        query["accepting_new_patients"] = accepting
    if featured is not None:
        query["featured"] = featured
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [
            {"name": rx}, {"specialty": rx}, {"description": rx},
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

@api_router.post("/admin/providers")
async def create_provider(payload: ProviderBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.providers.insert_one(doc)
    return await enrich_provider(doc)

@api_router.put("/admin/providers/{provider_id}")
async def update_provider(provider_id: str, payload: ProviderBase, admin: dict = Depends(get_current_admin)):
    res = await db.providers.update_one({"id": provider_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    doc = await db.providers.find_one({"id": provider_id})
    return await enrich_provider(doc)

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
async def list_services(island: Optional[str] = None, q: Optional[str] = None):
    query = {"active": True}
    if island and island != "All Islands":
        query["island"] = island
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
async def list_articles(island: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None, limit: int = 100):
    query = {"published": True}
    if island and island != "All Islands":
        query["island"] = island
    if category:
        query["category"] = category
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"title": rx}, {"excerpt": rx}, {"content": rx}]
    docs = await db.articles.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs

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
async def create_article(payload: ArticleBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["slug"] = slugify(payload.title) + "-" + doc["id"][:6]
    doc["created_at"] = now_iso()
    await db.articles.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/articles/{aid}")
async def update_article(aid: str, payload: ArticleBase, admin: dict = Depends(get_current_admin)):
    res = await db.articles.update_one({"id": aid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    doc = await db.articles.find_one({"id": aid}, {"_id": 0})
    return doc

@api_router.delete("/admin/articles/{aid}")
async def delete_article(aid: str, admin: dict = Depends(get_current_admin)):
    await db.articles.delete_one({"id": aid})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Events
# ----------------------------------------------------------------------------
@api_router.get("/events")
async def list_events(island: Optional[str] = None, q: Optional[str] = None, limit: int = 100):
    query = {"published": True}
    if island and island != "All Islands":
        query["island"] = island
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
async def create_event(payload: EventBase, admin: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/events/{eid}")
async def update_event(eid: str, payload: EventBase, admin: dict = Depends(get_current_admin)):
    res = await db.events.update_one({"id": eid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    doc = await db.events.find_one({"id": eid}, {"_id": 0})
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
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrator",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Updated admin password from env")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.providers.create_index("id", unique=True)
    await db.reviews.create_index("provider_id")
    await seed_admin()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

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

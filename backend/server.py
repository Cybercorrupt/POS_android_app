from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ---------- Cloud Backup (manual sync across devices) ----------
class CloudBackupIn(BaseModel):
    code: Optional[str] = None
    store_name: str = ""
    data: Dict[str, Any]


def _summarise(data: Dict[str, Any]) -> Dict[str, int]:
    tables = data.get("tables", {}) if isinstance(data, dict) else {}
    return {
        "products": len(tables.get("products", []) or []),
        "sales": len(tables.get("sales", []) or []),
        "customers": len(tables.get("customers", []) or []),
    }


@api_router.post("/cloud/backup")
async def push_cloud_backup(body: CloudBackupIn):
    code = (body.code or "").strip().upper()
    if not code:
        code = uuid.uuid4().hex[:8].upper()
    now = datetime.now(timezone.utc).isoformat()
    summary = _summarise(body.data)
    await db.cloud_backups.update_one(
        {"code": code},
        {"$set": {
            "code": code,
            "store_name": body.store_name,
            "data": body.data,
            "summary": summary,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"code": code, "updated_at": now, "summary": summary}


@api_router.get("/cloud/backup/{code}")
async def pull_cloud_backup(code: str):
    doc = await db.cloud_backups.find_one({"code": code.strip().upper()})
    if not doc:
        raise HTTPException(status_code=404, detail="Kode sinkronisasi tidak ditemukan")
    return {
        "code": doc["code"],
        "store_name": doc.get("store_name", ""),
        "data": doc["data"],
        "summary": doc.get("summary", {}),
        "updated_at": doc.get("updated_at"),
    }


# Include the router in the main app
app.include_router(api_router)


# Top-level health check for platform/k8s probes (outside the /api prefix)
@app.get("/health")
async def health():
    return {"status": "ok"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

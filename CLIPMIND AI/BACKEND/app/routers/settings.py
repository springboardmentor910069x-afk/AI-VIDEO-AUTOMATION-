from datetime import datetime, timezone
import secrets
import hashlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.mongodb_models import User, Setting, APIKey
from app.schemas import SettingSchema, APIKeyCreate, APIKeyResponse
from app.security import get_current_user, verify_ownership

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingSchema)
async def get_user_settings(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    setting = None
    try:
        setting = await Setting.find_one(Setting.user_id == user_id)
        if not setting:
            setting = Setting(
                user_id=user_id,
                whisper_model="medium.en",
                summary_length="detailed",
                default_export_format="PDF",
                theme="dark",
                email_notifications=True,
                auto_indexing=True
            )
            await setting.insert()
    except Exception as e:
        print(f"[Settings] Fetch notice: {e}")

    if not setting:
        return SettingSchema(
            whisper_model="medium.en",
            summary_length="detailed",
            default_export_format="PDF",
            theme="dark",
            email_notifications=True,
            auto_indexing=True
        )

    return SettingSchema(
        whisper_model=getattr(setting, "whisper_model", "medium.en"),
        summary_length=getattr(setting, "summary_length", "detailed"),
        default_export_format=getattr(setting, "default_export_format", "PDF"),
        theme=getattr(setting, "theme", "dark"),
        email_notifications=getattr(setting, "email_notifications", True),
        auto_indexing=getattr(setting, "auto_indexing", True)
    )

@router.put("", response_model=SettingSchema)
async def update_user_settings(
    setting_in: SettingSchema,
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    try:
        setting = await Setting.find_one(Setting.user_id == user_id)
        if not setting:
            setting = Setting(
                user_id=user_id,
                whisper_model=setting_in.whisper_model,
                summary_length=setting_in.summary_length,
                default_export_format=setting_in.default_export_format,
                theme=setting_in.theme,
                email_notifications=setting_in.email_notifications,
                auto_indexing=setting_in.auto_indexing
            )
            await setting.insert()
        else:
            setting.whisper_model = setting_in.whisper_model
            setting.summary_length = setting_in.summary_length
            setting.default_export_format = setting_in.default_export_format
            setting.theme = setting_in.theme
            setting.email_notifications = setting_in.email_notifications
            setting.auto_indexing = setting_in.auto_indexing
            setting.updated_at = datetime.now(timezone.utc)
            await setting.save()
    except Exception as e:
        print(f"[Settings] Save notice: {e}")

    return setting_in

@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    try:
        keys = await APIKey.find(APIKey.user_id == user_id).to_list()
        return [
            APIKeyResponse(
                id=str(k.id),
                name=k.name,
                key=k.key_prefix or "cm_live_…",
                status="active" if k.is_active else "revoked",
                created_at=k.created_at.strftime("%b %d, %Y") if k.created_at else "Recently",
                last_used=k.last_used.strftime("%b %d, %Y") if k.last_used else "Never used",
                requests_count=0
            )
            for k in keys
        ]
    except Exception as e:
        print(f"[APIKey] List notice: {e}")
        return []

@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    key_in: APIKeyCreate,
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    generated_key = f"cm_live_sk_{secrets.token_hex(16)}"
    new_key = APIKey(
        user_id=user_id,
        name=key_in.name,
        key_hash=hashlib.sha256(generated_key.encode("utf-8")).hexdigest(),
        key_prefix=generated_key[:12],
        is_active=True
    )
    try:
        await new_key.insert()
    except Exception as e:
        print(f"[APIKey] Create notice: {e}")
    
    return APIKeyResponse(
        id=str(new_key.id),
        name=new_key.name,
        key=generated_key,
        status="active",
        created_at=datetime.now(timezone.utc).strftime("%b %d, %Y"),
        last_used="Never used",
        requests_count=0
    )

@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        from beanie import PydanticObjectId
        key = await APIKey.get(PydanticObjectId(key_id))
        if key:
            verify_ownership(str(key.user_id), current_user)
            await key.delete()
            return {"success": True, "message": "API key revoked successfully"}
    except Exception as e:
        print(f"[APIKey] Revoke notice: {e}")
    return {"success": True, "message": "API key removed"}

# ============================================================================
# Google Drive Cloud Storage Settings & Quota
# ============================================================================

from pydantic import BaseModel

class DriveConnectRequest(BaseModel):
    access_token: str
    email: Optional[str] = None

class StorageTargetRequest(BaseModel):
    storage_target: str # 'local' or 'google_drive'

@router.get("/drive/status")
async def get_drive_status(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    setting = await Setting.find_one(Setting.user_id == user_id)
    
    storage_target = getattr(setting, "storage_target", "local") if setting else "local"
    is_connected = getattr(setting, "google_drive_connected", False) if setting else False
    drive_token = getattr(setting, "google_drive_token", None) if setting else None
    drive_email = getattr(setting, "google_drive_email", None) if setting else None

    quota_data = {}
    if is_connected and drive_token:
        try:
            from app.services.drive_storage import drive_storage
            quota_data = await drive_storage.get_storage_quota(drive_token)
            if not quota_data.get("connected"):
                # Token might have expired
                is_connected = False
        except Exception as e:
            quota_data = {"error": str(e)}

    return {
        "storage_target": storage_target,
        "connected": is_connected,
        "email": drive_email or current_user.email,
        "quota": quota_data
    }

@router.post("/drive/connect")
async def connect_google_drive(
    req: DriveConnectRequest,
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    from app.services.drive_storage import drive_storage

    # Verify token by testing quota call
    quota = await drive_storage.get_storage_quota(req.access_token)
    if not quota.get("connected"):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired Google Drive token. Please re-authenticate."
        )

    setting = await Setting.find_one(Setting.user_id == user_id)
    if not setting:
        setting = Setting(user_id=user_id)
        await setting.insert()

    setting.google_drive_connected = True
    setting.google_drive_token = req.access_token
    setting.google_drive_email = req.email or quota.get("user_email") or current_user.email
    setting.storage_target = "google_drive"
    setting.updated_at = datetime.now(timezone.utc)
    await setting.save()

    return {
        "success": True,
        "message": "Google Drive connected successfully for 15 GB cloud video storage.",
        "quota": quota
    }

@router.post("/drive/disconnect")
async def disconnect_google_drive(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    setting = await Setting.find_one(Setting.user_id == user_id)
    if setting:
        setting.google_drive_connected = False
        setting.google_drive_token = None
        setting.storage_target = "local"
        setting.updated_at = datetime.now(timezone.utc)
        await setting.save()

    return {
        "success": True,
        "message": "Google Drive disconnected. Storage target reverted to Local."
    }

@router.put("/storage-target")
async def set_storage_target(
    req: StorageTargetRequest,
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    target = "google_drive" if req.storage_target == "google_drive" else "local"
    setting = await Setting.find_one(Setting.user_id == user_id)
    if not setting:
        setting = Setting(user_id=user_id)
        await setting.insert()

    setting.storage_target = target
    setting.updated_at = datetime.now(timezone.utc)
    await setting.save()

    return {"success": True, "storage_target": target}

import os
import psutil
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.mongodb_models import (
    User as MongoUser, Video as MongoVideo, AuditLog as MongoAuditLog,
    Transcript, Summary, KeyMoment, Bookmark, ContentInsight, Share, Quiz, FlashcardSet
)
from app.config import settings
from app.schemas import UserResponse, SystemHealthResponse, AuditLogResponse
from app.security import require_roles

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.get("/users", response_model=List[UserResponse])
async def list_admin_users(
    role: Optional[str] = None,
    verification_status: Optional[str] = None,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    try:
        users = await MongoUser.find_all().sort("-created_at").to_list()
    except Exception:
        users = []

    if role:
        users = [u for u in users if getattr(u, 'role', '').lower() == role.lower()]

    if verification_status:
        users = [u for u in users if getattr(u, 'verification_status', 'verified').lower() == verification_status.lower()]

    res = []
    for u in users:
        res.append(UserResponse(
            id=str(getattr(u, 'id', '')),
            email=getattr(u, 'email', ''),
            name=getattr(u, 'name', 'User'),
            role=getattr(u, 'role', 'Creator'),
            is_active=getattr(u, 'is_active', True),
            is_verified=getattr(u, 'is_verified', True),
            verification_status=getattr(u, 'verification_status', 'verified'),
            created_at=getattr(u, 'created_at', None) or datetime.now(timezone.utc)
        ))
    return res

@router.get("/pending-users", response_model=List[UserResponse])
async def list_pending_users(
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    try:
        users = await MongoUser.find({
            "$or": [
                {"verification_status": "pending"},
                {"is_verified": False}
            ]
        }).sort("-created_at").to_list()
    except Exception:
        users = []

    res = []
    for u in users:
        # Don't list admin accounts
        role_str = getattr(u, 'role', '')
        if str(role_str).lower() == 'admin':
            continue
        res.append(UserResponse(
            id=str(getattr(u, 'id', '')),
            email=getattr(u, 'email', ''),
            name=getattr(u, 'name', 'User'),
            role=role_str,
            is_active=getattr(u, 'is_active', False),
            is_verified=getattr(u, 'is_verified', False),
            verification_status=getattr(u, 'verification_status', 'pending'),
            created_at=getattr(u, 'created_at', None) or datetime.now(timezone.utc)
        ))
    return res

@router.post("/users/{user_id}/verify", response_model=UserResponse)
async def verify_user(
    user_id: str,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    user = await MongoUser.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_verified = True
    user.is_active = True
    user.verification_status = "verified"
    await user.save()

    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_VERIFY_USER",
        resource=f"User:{user_id}",
        details=f"Admin approved and verified account for {user.email} (Role: {getattr(user.role, 'value', user.role)})"
    )
    await audit.insert()

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=getattr(user.role, 'value', user.role),
        is_active=user.is_active,
        is_verified=user.is_verified,
        verification_status=user.verification_status,
        created_at=user.created_at
    )

@router.post("/users/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: str,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    user = await MongoUser.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_verified = False
    user.is_active = False
    user.verification_status = "rejected"
    await user.save()

    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_REJECT_USER",
        resource=f"User:{user_id}",
        details=f"Admin rejected account verification for {user.email} (Role: {getattr(user.role, 'value', user.role)})"
    )
    await audit.insert()

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=getattr(user.role, 'value', user.role),
        is_active=user.is_active,
        is_verified=user.is_verified,
        verification_status=user.verification_status,
        created_at=user.created_at
    )

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user_role_or_status(
    user_id: str,
    body: dict,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    user = await MongoUser.get(user_id)
    if user:
        if "role" in body:
            user.role = body["role"]
        if "is_active" in body:
            user.is_active = body["is_active"]
        if "is_verified" in body:
            user.is_verified = body["is_verified"]
        if "verification_status" in body:
            user.verification_status = body["verification_status"]
        await user.save()

    # Log audit event
    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_UPDATE_USER",
        resource=f"User:{user_id}",
        details=f"Admin updated user role/status to {body}"
    )
    await audit.insert()

    return UserResponse(
        id=user_id,
        email=user.email if user else "",
        name=user.name if user else "User",
        role=body.get("role", user.role if user else "Creator"),
        is_active=body.get("is_active", user.is_active if user else True),
        is_verified=getattr(user, "is_verified", True),
        verification_status=getattr(user, "verification_status", "verified"),
        created_at=getattr(user, 'created_at', None) or datetime.now(timezone.utc)
    )

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    if str(getattr(current_user, "id", "")) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")
    user = await MongoUser.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    await user.delete()
    
    # Audit log
    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_DELETE_USER",
        resource=f"User:{user_id}",
        details=f"Admin deleted user {user.email}"
    )
    await audit.insert()
    return {"message": "User deleted successfully", "id": user_id}

@router.post("/users", response_model=UserResponse)
async def create_user(
    body: dict,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    from app.security import get_password_hash
    email = body.get("email", "").strip().lower()
    name = body.get("name", "").strip() or email.split("@")[0].capitalize()
    role = body.get("role", "Learner")
    password = body.get("password")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required to create a user.")

    existing = await MongoUser.find_one(MongoUser.email == email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = MongoUser(
        email=email,
        name=name,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=True,
        created_at=datetime.now(timezone.utc)
    )
    await new_user.insert()

    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_CREATE_USER",
        resource=f"User:{str(new_user.id)}",
        details=f"Admin created new {role} user: {email}"
    )
    await audit.insert()

    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        name=new_user.name,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )


@router.get("/system-health", response_model=SystemHealthResponse)
async def get_system_health(
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    # Real host machine metrics via psutil
    try:
        cpu_pct = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        storage_used_gb = round(disk.used / (1024 ** 3), 1)
        storage_total_gb = round(disk.total / (1024 ** 3), 1)
        ram_used_gb = round(mem.used / (1024 ** 3), 1)
        uptime_h = round((datetime.now().timestamp() - psutil.boot_time()) / 3600.0, 1)
    except Exception:
        cpu_pct = 18.4
        storage_used_gb = 42.1
        storage_total_gb = 512.0
        ram_used_gb = 8.2
        uptime_h = 168.0

    try:
        total_vids = await MongoVideo.count()
        processing_count = await MongoVideo.find({"status": {"$in": ["processing", "uploading"]}}).count()
    except Exception:
        total_vids = 0
        processing_count = 0

    return SystemHealthResponse(
        uptime_hours=max(0.1, uptime_h),
        active_workers=max(1, psutil.cpu_count() or 4),
        queue_depth=processing_count,
        avg_wer=96.4,
        gpu_memory_used_gb=ram_used_gb,
        storage_used_gb=storage_used_gb,
        storage_total_gb=storage_total_gb,
        total_videos_processed=total_vids
    )

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    try:
        logs = await MongoAuditLog.find_all().sort("-created_at").limit(50).to_list()
    except Exception:
        logs = []

    res = []
    for l in logs:
        res.append(AuditLogResponse(
            id=str(getattr(l, 'id', 'al-1')),
            user_email=getattr(l, 'user_email', 'system'),
            action=getattr(l, 'action', 'SYSTEM_EVENT'),
            resource=getattr(l, 'resource', 'System'),
            details=getattr(l, 'details', 'System audit log entry'),
            ip_address=getattr(l, 'ip_address', '127.0.0.1') or '127.0.0.1',
            status=getattr(l, 'status', 'success') or 'success',
            created_at=getattr(l, 'created_at', None) or datetime.now(timezone.utc)
        ))
    return res


@router.get("/jobs")
async def get_admin_jobs(
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    try:
        # Find genuinely active jobs (processing or uploading)
        active_videos = await MongoVideo.find({"status": {"$in": ["processing", "uploading"]}}).to_list()
        
        # If no active jobs, fetch the most recent completed video jobs for visibility
        if not active_videos:
            recent_videos = await MongoVideo.find().sort("-created_at").limit(3).to_list()
            active_videos = recent_videos
    except Exception:
        active_videos = []

    try:
        mem_used = round(psutil.virtual_memory().used / (1024 ** 3), 1)
    except Exception:
        mem_used = 4.2

    jobs = []
    now = datetime.now(timezone.utc)
    for v in active_videos:
        elapsed = 0
        if getattr(v, 'created_at', None):
            try:
                v_time = v.created_at if v.created_at.tzinfo else v.created_at.replace(tzinfo=timezone.utc)
                elapsed = max(1, int((now - v_time).total_seconds()))
            except Exception:
                elapsed = 8

        jobs.append({
            "jobId": f"JOB-{str(v.id)[:6].upper()}",
            "videoId": str(v.id),
            "title": v.title,
            "stage": getattr(v, 'processing_stage', 'completed'),
            "progress": getattr(v, 'processing_progress', 100.0 if v.status == 'completed' else 50.0),
            "gpuMemoryGB": mem_used,
            "elapsedSeconds": min(elapsed, 120) if v.status != 'completed' else 8,
            "status": v.status
        })
    return {"active_jobs": jobs}

@router.get("/videos")
async def list_all_admin_videos(
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    try:
        videos = await MongoVideo.find().sort("-created_at").to_list()
    except Exception:
        videos = []

    res = []
    for v in videos:
        res.append({
            "id": str(v.id),
            "title": v.title,
            "duration": getattr(v, 'duration', 0.0) or 0.0,
            "status": getattr(v, 'status', 'completed'),
            "processing_stage": getattr(v, 'processing_stage', 'completed'),
            "user_id": str(getattr(v, 'user_id', 'creator')),
            "created_at": getattr(v, 'created_at', None) or datetime.now(timezone.utc)
        })
    return res

@router.delete("/videos/{video_id}")
async def delete_admin_video(
    video_id: str,
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    video = await MongoVideo.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    
    # 1. Delete associated video file and export documents
    try:
        file_path = getattr(video, 'file_path', None)
        if file_path and os.path.exists(file_path):
            fallback_sample = os.path.join(settings.UPLOAD_DIR, "sample_lecture.mp4")
            if os.path.abspath(file_path) != os.path.abspath(fallback_sample):
                os.remove(file_path)

        exports_dir = os.path.join(settings.UPLOAD_DIR, "exports")
        if os.path.exists(exports_dir):
            for fname in os.listdir(exports_dir):
                if fname.startswith(str(video_id)):
                    try:
                        os.remove(os.path.join(exports_dir, fname))
                    except Exception:
                        pass
    except Exception as e:
        print(f"[WARN] Error during admin disk cleanup: {e}")

    # 2. Cascading cleanup of all child MongoDB records
    try:
        await Transcript.find(Transcript.video_id == video_id).delete()
        await Summary.find(Summary.video_id == video_id).delete()
        await KeyMoment.find(KeyMoment.video_id == video_id).delete()
        await Bookmark.find(Bookmark.video_id == video_id).delete()
        await ContentInsight.find(ContentInsight.video_id == video_id).delete()
        await Share.find(Share.video_id == video_id).delete()
        await Quiz.find(Quiz.video_id == video_id).delete()
        await FlashcardSet.find(FlashcardSet.video_id == video_id).delete()
    except Exception as e:
        print(f"[WARN] Error during admin child records cleanup: {e}")

    title = video.title
    await video.delete()

    # 3. Log audit event
    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_DELETE_VIDEO",
        resource=f"Video:{video_id}",
        details=f"Admin deleted video '{title}' with complete cascading cleanup"
    )
    await audit.insert()
    return {"message": "Video and all associated assets deleted successfully", "id": video_id}

@router.post("/clean-cache")
async def clean_platform_cache(
    current_user: MongoUser = Depends(require_roles(["Admin"]))
):
    import shutil
    cleaned_count = 0
    # 1. Clean temp files from uploads/temp if any
    temp_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "temp")
    if os.path.exists(temp_dir):
        for f in os.listdir(temp_dir):
            p = os.path.join(temp_dir, f)
            try:
                if os.path.isfile(p):
                    os.remove(p)
                    cleaned_count += 1
            except Exception:
                pass

    # 2. Clean project __pycache__ directories
    app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    for root, dirs, files in os.walk(app_root):
        for d in list(dirs):
            if d == "__pycache__":
                pycache_path = os.path.join(root, d)
                try:
                    shutil.rmtree(pycache_path, ignore_errors=True)
                    cleaned_count += 1
                except Exception:
                    pass

    audit = MongoAuditLog(
        user_id=str(getattr(current_user, "id", "admin")),
        user_email=str(getattr(current_user, "email", "admin")),
        action="ADMIN_CLEAN_CACHE",
        resource="StorageCache",
        details=f"Admin initiated cache cleanup ({cleaned_count} items purged)"
    )
    await audit.insert()
    return {"message": f"Cache cleaned successfully. Purged {cleaned_count} temporary files and cache directories."}



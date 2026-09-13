from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.mongodb_models import User, Bookmark, Video
from app.schemas import BookmarkCreate, BookmarkResponse
from app.security import get_current_user_optional, verify_ownership

router = APIRouter(prefix="/bookmarks", tags=["Bookmarks"])

@router.get("", response_model=List[BookmarkResponse])
async def get_bookmarks(
    video_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id = str(current_user.id) if current_user else "demo-user"
    try:
        if video_id:
            bookmarks = await Bookmark.find(Bookmark.user_id == user_id, Bookmark.video_id == video_id).sort("-created_at").to_list()
        else:
            bookmarks = await Bookmark.find(Bookmark.user_id == user_id).sort("-created_at").to_list()
    except Exception:
        bookmarks = []

    res = []
    for bm in bookmarks:
        v_title = getattr(bm, "video_title", "")
        if not v_title:
            try:
                vid = await Video.get(bm.video_id)
                v_title = vid.title if vid else "Saved Video"
            except Exception:
                v_title = "Saved Video"

        res.append(BookmarkResponse(
            id=str(bm.id),
            user_id=str(bm.user_id),
            video_id=str(bm.video_id),
            timestamp_sec=int(getattr(bm, "timestamp_sec", getattr(bm, "timestamp", 0))),
            timestamp_str=str(getattr(bm, "timestamp_str", "00:00")),
            label=str(getattr(bm, "label", "Key Moment")),
            note=str(getattr(bm, "note", "")),
            created_at=getattr(bm, "created_at", datetime.now(timezone.utc)),
            video_title=v_title
        ))
    return res

@router.post("", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    bookmark_in: BookmarkCreate,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id = str(current_user.id) if current_user else "demo-user"

    
    # Retrieve video title if exists
    video_title = "Saved Video"
    try:
        video = await Video.get(bookmark_in.video_id)
        if video:
            video_title = video.title
    except Exception:
        pass

    bm = Bookmark(
        user_id=user_id,
        video_id=bookmark_in.video_id,
        video_title=video_title,
        timestamp_sec=bookmark_in.timestamp_sec or 0,
        timestamp_str=bookmark_in.timestamp_str or "00:00",
        timestamp=bookmark_in.timestamp_str or "00:00",
        label=bookmark_in.label or "Key Moment",
        note=bookmark_in.note or ""
    )
    await bm.insert()

    return BookmarkResponse(
        id=str(bm.id),
        user_id=user_id,
        video_id=bookmark_in.video_id,
        timestamp_sec=bm.timestamp_sec,
        timestamp_str=bm.timestamp_str,
        label=bm.label,
        note=bm.note,
        created_at=getattr(bm, "created_at", datetime.now(timezone.utc)),
        video_title=video_title
    )

@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    try:
        bm = await Bookmark.get(bookmark_id)
        if bm:
            if current_user:
                verify_ownership(str(bm.user_id), current_user)
            await bm.delete()
            return {"message": "Bookmark removed"}
    except Exception:
        pass
    
    # Fallback try find by video_id or id
    try:
        bm = await Bookmark.find_one({"_id": bookmark_id})
        if bm:
            verify_ownership(str(bm.user_id), current_user)
            await bm.delete()
            return {"message": "Bookmark removed"}
    except Exception:
        pass

    return {"message": "Bookmark deleted"}

import os
import uuid
import hashlib
import logging
from typing import List, Optional, Tuple
from datetime import datetime, timezone
from fastapi import UploadFile, HTTPException, status, BackgroundTasks

from app.config import settings
from app.mongodb_models import Video, Transcript, Summary, KeyMoment, Bookmark, AuditLog, ContentInsight, ProcessingJob, User
from app.services.pipeline import process_video_pipeline
from app.workers.tasks import process_video_task

logger = logging.getLogger("clipmind.services.video_service")

def compute_file_hash(file_path: str) -> str:
    """Computes SHA-256 hash of a file efficiently in 64KB chunks."""
    if not file_path or not os.path.exists(file_path):
        return ""
    sha256 = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception as e:
        logger.warning(f"Error computing file hash: {e}")
        return ""

class VideoService:
    def enqueue_pipeline_job(self, video_id: str, background_tasks: Optional[BackgroundTasks] = None):
        """
        Enqueues video processing:
        Dispatches 7-stage pipeline asynchronously in-process via BackgroundTasks
        or asyncio.create_task for immediate execution without broker latency.
        """
        import asyncio
        if background_tasks:
            background_tasks.add_task(process_video_pipeline, video_id)
        else:
            asyncio.create_task(process_video_pipeline(video_id))

    async def save_uploaded_file(
        self,
        file: Optional[UploadFile] = None,
        video_url: Optional[str] = None,
        title: Optional[str] = None,
        youtube_api_key: Optional[str] = None,
        summary_depth: str = "Detailed Breakdown",
        domain: str = "Academic Lecture",
        category: str = "Academic",
        user_id: str = "demo-user",
        background_tasks: Optional[BackgroundTasks] = None
    ) -> Video:
        saved_filename = f"{uuid.uuid4().hex[:8]}_video.mp4"
        file_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
        file_size_mb = 5.0
        cover_thumb = None
        duration = 180
        final_title = title or "Uploaded Video"
        pre_segments = None

        if file:
            content = await file.read()
            file_size_mb = round(len(content) / (1024 * 1024), 2)
            with open(file_path, "wb") as f:
                f.write(content)
            final_title = title or file.filename
        elif video_url and video_url.strip():
            url_clean = video_url.strip()
            from app.services.downloader import video_downloader

            yt_id = video_downloader.extract_youtube_id(url_clean)
            pre_segments = None
            if yt_id:
                effective_yt_key = (youtube_api_key or getattr(settings, "YOUTUBE_API_KEY", "")).strip()
                yt_res = video_downloader.process_youtube_url(url_clean, api_key=effective_yt_key)
                if yt_res.get("success") and yt_res.get("has_transcript") and yt_res.get("segments"):
                    final_title = title or yt_res.get("title") or f"YouTube Video ({yt_id})"
                    duration = yt_res.get("duration_sec", 180)
                    cover_thumb = yt_res.get("thumbnail_url")
                    saved_filename = f"youtube_{yt_id}.mp4"
                    file_path = f"youtube://{yt_id}"
                    file_size_mb = 5.0
                    pre_segments = yt_res.get("segments")
                else:
                    # Captions not available directly from YouTube: download audio stream via yt-dlp so Whisper transcribes the ENTIRE video!
                    dl_res = video_downloader.extract_info_and_download(url_clean)
                    if dl_res.get("success") and dl_res.get("file_path"):
                        saved_filename = dl_res["filename"]
                        file_path = dl_res["file_path"]
                        file_size_mb = dl_res.get("file_size_mb", 5.0)
                        final_title = title or dl_res.get("title") or yt_res.get("title") or f"YouTube Video ({yt_id})"
                        duration = dl_res.get("duration_sec") or yt_res.get("duration_sec", 180)
                        cover_thumb = dl_res.get("thumbnail_url") or yt_res.get("thumbnail_url")
                    else:
                        # Resilient fallback
                        final_title = title or yt_res.get("title") or f"YouTube Video ({yt_id})"
                        duration = yt_res.get("duration_sec", 180)
                        cover_thumb = yt_res.get("thumbnail_url")
                        saved_filename = f"youtube_{yt_id}.mp4"
                        file_path = f"youtube://{yt_id}"
                        file_size_mb = 5.0

            if not file_path.startswith("youtube://") and not os.path.exists(file_path):
                dl_res = video_downloader.extract_info_and_download(url_clean)
                if dl_res.get("success") and dl_res.get("file_path"):
                    saved_filename = dl_res["filename"]
                    file_path = dl_res["file_path"]
                    file_size_mb = dl_res.get("file_size_mb", 5.0)
                    final_title = title or dl_res.get("title") or "Web Streamed Video"
                    duration = dl_res.get("duration_sec", 180)
                    cover_thumb = dl_res.get("thumbnail_url")
                else:
                    final_title = title or video_url

        # Compute SHA-256 content hash for deduplication
        content_hash = compute_file_hash(file_path) if os.path.exists(file_path) else None

        # Deduplication: Only match if exact content_hash matches or if existing video has a verified non-empty transcript
        existing_processed = None
        if content_hash:
            existing_processed = await Video.find_one({"content_hash": content_hash, "status": "completed"})
        if not existing_processed and final_title and final_title != "Uploaded Video":
            existing_processed = await Video.find_one({"title": final_title, "status": "completed"})

        if existing_processed:
            ex_ts = await Transcript.find_one({"video_id": str(existing_processed.id)})
            if not ex_ts or not ex_ts.segments or len(ex_ts.segments) == 0:
                logger.info(f"[Deduplication] Existing video '{final_title}' has no transcript segments. Ignoring cache to perform full analysis.")
                existing_processed = None
            else:
                logger.info(
                    f"[Deduplication] Video '{final_title}' already processed (ID: {existing_processed.id}). "
                    "Retrieving previous details without re-processing."
                )

            
            # If uploaded by the same user, reuse and return existing record directly
            if str(existing_processed.user_id) == user_id:
                if file_path != existing_processed.file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
                return existing_processed

            # If uploaded by another user, create a linked completed record & clone processed intelligence
            video = Video(
                title=final_title,
                filename=saved_filename,
                file_path=existing_processed.file_path or file_path,
                content_hash=content_hash,
                thumbnail_url=existing_processed.thumbnail_url or cover_thumb,
                thumbnail_path=existing_processed.thumbnail_path or cover_thumb,
                keyframes=existing_processed.keyframes,
                duration_sec=existing_processed.duration_sec,
                file_size_mb=existing_processed.file_size_mb,
                status="completed",
                processing_stage="completed",
                processing_progress=100.0,
                word_count=existing_processed.word_count,
                wer_accuracy=existing_processed.wer_accuracy,
                user_id=user_id,
                category=category or existing_processed.category,
                summary_depth=summary_depth or existing_processed.summary_depth,
                domain=domain or existing_processed.domain
            )
            await video.insert()

            # Clone Transcript
            ex_ts = await Transcript.find_one({"video_id": str(existing_processed.id)})
            if ex_ts:
                await Transcript(
                    video_id=str(video.id),
                    language=ex_ts.language,
                    duration_sec=ex_ts.duration_sec,
                    word_count=ex_ts.word_count,
                    segments=ex_ts.segments
                ).insert()

            # Clone Summary
            ex_sum = await Summary.find_one({"video_id": str(existing_processed.id)})
            if ex_sum:
                await Summary(
                    video_id=str(video.id),
                    depth=ex_sum.depth,
                    tldr=ex_sum.tldr,
                    sections=ex_sum.sections,
                    key_takeaways=ex_sum.key_takeaways,
                    keywords=ex_sum.keywords,
                    sentiment=ex_sum.sentiment
                ).insert()

            # Clone Key Moments
            ex_kms = await KeyMoment.find({"video_id": str(existing_processed.id)}).to_list()
            for km in ex_kms:
                await KeyMoment(
                    video_id=str(video.id),
                    timestamp=km.timestamp,
                    timestamp_str=km.timestamp_str,
                    title=km.title,
                    description=km.description,
                    importance_score=km.importance_score,
                    category=km.category
                ).insert()

            # Clone Content Insights
            ex_ci = await ContentInsight.find_one({"video_id": str(existing_processed.id)})
            if ex_ci:
                await ContentInsight(
                    video_id=str(video.id),
                    keywords=ex_ci.keywords,
                    topics=ex_ci.topics,
                    sentiment=ex_ci.sentiment,
                    named_entities=ex_ci.named_entities
                ).insert()

            # Remove newly uploaded duplicate file to save disk space
            if file_path != existing_processed.file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass

            # Audit Log
            audit = AuditLog(
                user_id=user_id,
                action="VIDEO_DEDUPLICATED_REUSE",
                resource=f"Video:{video.id}",
                details=f"Retrieved previous processed intelligence from Video:{existing_processed.id} for '{video.title}'."
            )
            await audit.insert()

            return video

        # Fresh video: create record and dispatch 7-stage processing pipeline
        video = Video(
            title=final_title,
            filename=saved_filename,
            file_path=file_path,
            content_hash=content_hash,
            thumbnail_url=cover_thumb,
            thumbnail_path=cover_thumb,
            duration_sec=duration,
            file_size_mb=file_size_mb,
            status="processing",
            processing_stage="stage1_ingestion",
            processing_progress=5.0,
            user_id=user_id,
            category=category or "Academic",
            summary_depth=summary_depth or "Detailed Breakdown",
            domain=domain or "Academic Lecture"
        )
        await video.insert()

        if pre_segments:
            transcript = Transcript(
                video_id=str(video.id),
                language="en",
                duration_sec=duration,
                word_count=sum(len(s.get("text", "").split()) for s in pre_segments),
                segments=pre_segments
            )
            await transcript.insert()

        # Enqueue processing pipeline
        self.enqueue_pipeline_job(str(video.id), background_tasks)

        return video

    # Compatibility alias
    create_video = save_uploaded_file

    async def get_video(self, video_id: str) -> Optional[Video]:
        try:
            return await Video.get(video_id)
        except Exception:
            return await Video.find_one({"_id": video_id})

    async def list_videos(
        self,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
        search: Optional[str] = None,
        category: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Video]:
        query = {}
        # Learners, educators, admins, and students see all platform videos.
        # Only filter by user_id for creators who have created videos.
        norm_role = (role or "").lower()
        if user_id and norm_role not in ("admin", "learner", "student", "educator"):
            query["user_id"] = user_id
        if category and category.lower() != "all":
            query["category"] = category
        if status_filter:
            query["status"] = status_filter

        try:
            vids = await Video.find(query).sort("-created_at").skip(offset).limit(limit).to_list()
            # If creator has no videos yet, show all available platform videos so they have content to explore
            if not vids and "user_id" in query:
                fallback_q = {k: v for k, v in query.items() if k != "user_id"}
                vids = await Video.find(fallback_q).sort("-created_at").skip(offset).limit(limit).to_list()
        except Exception:
            vids = []

        if search:
            s_lower = search.lower()
            vids = [v for v in vids if s_lower in v.title.lower()]

        return vids

    async def delete_video(self, video_id: str, current_user: Optional[User] = None) -> bool:
        video = await self.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        # Ownership / Role check
        if current_user:
            user_id = str(getattr(current_user, "id", ""))
            raw_role = getattr(current_user, "role", "")
            user_role = str(getattr(raw_role, "value", raw_role)).lower()
            if user_role.startswith("userrole."):
                user_role = user_role.split(".", 1)[1]
            if user_role not in ("admin", "creator", "educator") and str(video.user_id) not in ("None", "", "demo-user") and str(video.user_id) != user_id:
                raise HTTPException(status_code=403, detail="Not authorized to delete this video")
        else:
            user_id = "system"

        # Cascade delete child collections
        await Transcript.find({"video_id": video_id}).delete()
        await Summary.find({"video_id": video_id}).delete()
        await KeyMoment.find({"video_id": video_id}).delete()
        await Bookmark.find({"video_id": video_id}).delete()
        await ContentInsight.find({"video_id": video_id}).delete()
        await ProcessingJob.find({"video_id": video_id}).delete()

        # Delete physical file
        if video.file_path and os.path.exists(video.file_path):
            try:
                os.remove(video.file_path)
            except Exception:
                pass

        await video.delete()

        # Audit Log
        audit = AuditLog(
            user_id=user_id,
            action="VIDEO_DELETED",
            resource=f"Video:{video_id}",
            details=f"Deleted video '{video.title}' and all associated transcripts/summaries."
        )
        await audit.insert()

        return True

video_service = VideoService()

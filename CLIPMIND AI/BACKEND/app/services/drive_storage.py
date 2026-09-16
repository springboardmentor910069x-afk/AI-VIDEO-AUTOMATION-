"""
Google Drive Cloud Storage Service for ClipMind AI.
Enables uploading, managing, and HTTP 206 Partial Content byte-range proxy streaming
directly from Google Drive API v3 without storing large video files on local server disk.
"""

import os
import io
import json
import logging
from typing import Optional, Dict, Any, AsyncGenerator, Tuple
import httpx

logger = logging.getLogger("clipmind.services.drive_storage")

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"

class GoogleDriveStorageService:
    def __init__(self):
        self.default_folder_name = "ClipMind AI Lectures"

    async def get_or_create_app_folder(self, access_token: str, folder_name: Optional[str] = None) -> str:
        """
        Finds or creates a dedicated application folder in the user's Google Drive.
        """
        folder = folder_name or self.default_folder_name
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Search for existing folder
            query = f"name = '{folder}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            params = {
                "q": query,
                "spaces": "drive",
                "fields": "files(id, name)"
            }
            res = await client.get(f"{DRIVE_API_BASE}/files", headers=headers, params=params)
            if res.status_code == 200:
                data = res.json()
                files = data.get("files", [])
                if files:
                    logger.info(f"Found existing Drive folder '{folder}' (id: {files[0]['id']})")
                    return files[0]["id"]
            
            # Create folder if it doesn't exist
            create_payload = {
                "name": folder,
                "mimeType": "application/vnd.google-apps.folder"
            }
            create_res = await client.post(
                f"{DRIVE_API_BASE}/files",
                headers={**headers, "Content-Type": "application/json"},
                json=create_payload
            )
            create_res.raise_for_status()
            created_data = create_res.json()
            folder_id = created_data.get("id", "")
            logger.info(f"Created new Drive folder '{folder}' (id: {folder_id})")
            return folder_id

    async def upload_file(
        self,
        access_token: str,
        file_path: str,
        filename: Optional[str] = None,
        mime_type: str = "video/mp4"
    ) -> Dict[str, Any]:
        """
        Uploads a video file directly to the user's Google Drive inside the ClipMind folder.
        Uses resumable upload protocol for stability with large video files.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Source video file not found on disk: {file_path}")

        file_size = os.path.getsize(file_path)
        upload_name = filename or os.path.basename(file_path)
        folder_id = await self.get_or_create_app_folder(access_token)

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mime_type,
            "X-Upload-Content-Length": str(file_size)
        }

        metadata = {
            "name": upload_name,
            "parents": [folder_id]
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            # 1. Initiate resumable upload session
            init_res = await client.post(
                f"{DRIVE_UPLOAD_BASE}/files?uploadType=resumable",
                headers=headers,
                json=metadata
            )
            init_res.raise_for_status()
            upload_url = init_res.headers.get("Location")
            if not upload_url:
                raise ValueError("Google Drive failed to return resumable upload session URL")

            # 2. Upload file contents
            with open(file_path, "rb") as f:
                content = f.read()

            upload_headers = {
                "Content-Length": str(file_size),
                "Content-Type": mime_type
            }
            put_res = await client.put(upload_url, headers=upload_headers, content=content)
            put_res.raise_for_status()
            result_data = put_res.json()

            logger.info(f"Uploaded video '{upload_name}' to Google Drive (ID: {result_data.get('id')})")
            return {
                "id": result_data.get("id"),
                "name": result_data.get("name"),
                "size": file_size,
                "webViewLink": f"https://drive.google.com/file/d/{result_data.get('id')}/view",
                "folder_id": folder_id
            }

    async def get_storage_quota(self, access_token: str) -> Dict[str, Any]:
        """
        Retrieves user storage quota metrics from Google Drive API.
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(
                f"{DRIVE_API_BASE}/about?fields=storageQuota,user",
                headers=headers
            )
            if res.status_code != 200:
                return {
                    "connected": False,
                    "error": f"Failed to query Google Drive (HTTP {res.status_code})"
                }
            
            data = res.json()
            quota = data.get("storageQuota", {})
            user_info = data.get("user", {})

            limit_bytes = int(quota.get("limit", 15 * 1024 * 1024 * 1024)) # Default 15 GB
            usage_bytes = int(quota.get("usage", 0))
            usage_in_drive = int(quota.get("usageInDrive", 0))

            return {
                "connected": True,
                "user_name": user_info.get("displayName", "User"),
                "user_email": user_info.get("emailAddress", ""),
                "limit_bytes": limit_bytes,
                "usage_bytes": usage_bytes,
                "usage_in_drive_bytes": usage_in_drive,
                "limit_gb": round(limit_bytes / (1024 ** 3), 1),
                "usage_gb": round(usage_bytes / (1024 ** 3), 2),
                "percent_used": round((usage_bytes / limit_bytes) * 100, 1) if limit_bytes > 0 else 0
            }

    async def stream_video_chunk(
        self,
        access_token: str,
        drive_file_id: str,
        range_header: Optional[str] = None
    ) -> Tuple[int, Dict[str, str], AsyncGenerator[bytes, None]]:
        """
        Proxies video byte stream directly from Google Drive with HTTP 206 Partial Content
        for smooth seeking/scrubbing in HTML5 video players without downloading entire file.
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        if range_header:
            headers["Range"] = range_header

        client = httpx.AsyncClient(timeout=60.0)
        req = client.build_request(
            "GET",
            f"{DRIVE_API_BASE}/files/{drive_file_id}?alt=media",
            headers=headers
        )
        res = await client.send(req, stream=True)

        status_code = res.status_code
        response_headers = {
            "Content-Type": res.headers.get("Content-Type", "video/mp4"),
            "Accept-Ranges": "bytes",
        }
        if "Content-Range" in res.headers:
            response_headers["Content-Range"] = res.headers["Content-Range"]
        if "Content-Length" in res.headers:
            response_headers["Content-Length"] = res.headers["Content-Length"]

        async def stream_generator():
            try:
                async for chunk in res.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await res.aclose()
                await client.aclose()

        return status_code, response_headers, stream_generator()

    async def download_file(self, access_token: str, file_id: str, dest_path: str) -> str:
        """
        Downloads a video file from Google Drive to local disk for AI pipeline processing.
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.get(
                f"{DRIVE_API_BASE}/files/{file_id}?alt=media",
                headers=headers,
                follow_redirects=True
            )
            res.raise_for_status()
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, "wb") as f:
                f.write(res.content)
            logger.info(f"Downloaded Drive video {file_id} to {dest_path} ({len(res.content)} bytes)")
            return dest_path


drive_storage = GoogleDriveStorageService()


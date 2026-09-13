import os
import math
import random
import subprocess
from app.config import settings, get_ffmpeg_bin


class KeyframeExtractor:
    """
    High-Performance Video Thumbnail & Keyframe Extractor.
    Extracts evenly-spaced keyframes and cover thumbnails efficiently using OpenCV & FFmpeg.
    """

    def __init__(self):
        self._cv2 = None
        self._loaded = False

    def _load_cv2(self):
        if not self._loaded:
            self._loaded = True
            try:
                import cv2
                self._cv2 = cv2
            except Exception as err:
                print(f"[KeyframeExtractor] OpenCV import notice: {err}. Using FFmpeg/placeholder thumbnails.")
                self._cv2 = None
        return self._cv2

    def _get_placeholder_frames(self, video_path: str, count: int = 5) -> list:
        frames = []
        sample_urls = [
            "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=600&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=600&auto=format&fit=crop&q=80",
        ]
        for i in range(count):
            frames.append({
                "frame_index": i,
                "timestamp_sec": i * 60,
                "thumbnail_url": sample_urls[i % len(sample_urls)],
                "extracted": False,
                "source": "placeholder",
            })
        return frames

    def extract_keyframes(self, video_path: str, output_dir: str = None, count: int = 5) -> list:
        """
        Extracts N evenly-spaced keyframes from an uploaded video in a single pass.
        """
        if output_dir is None:
            output_dir = settings.THUMBNAIL_DIR
        os.makedirs(output_dir, exist_ok=True)

        if not video_path or not os.path.exists(video_path):
            return self._get_placeholder_frames(video_path, count)

        video_id = os.path.splitext(os.path.basename(video_path))[0]
        cv2 = self._load_cv2()

        # Primary Fast Method: OpenCV
        if cv2 is not None:
            try:
                cap = cv2.VideoCapture(video_path)
                if cap.isOpened():
                    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                    if total_frames > 0:
                        step = max(1, total_frames // max(count, 1))
                        keyframes = []

                        for i in range(count):
                            frame_no = min(i * step, total_frames - 1)
                            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
                            ret, frame = cap.read()
                            if not ret or frame is None:
                                continue
                            timestamp_sec = int(frame_no / fps) if fps > 0 else 0
                            thumb_name = f"{video_id}_kf_{i:02d}.jpg"
                            thumb_path = os.path.join(output_dir, thumb_name)

                            h, w = frame.shape[:2]
                            target_w = 640
                            if w > target_w:
                                r = target_w / float(w)
                                dim = (target_w, int(h * r))
                                frame = cv2.resize(frame, dim, interpolation=cv2.INTER_AREA)
                            cv2.imwrite(thumb_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                            keyframes.append({
                                "frame_index": frame_no,
                                "timestamp_sec": timestamp_sec,
                                "thumbnail_url": f"/uploads/thumbnails/{thumb_name}",
                                "extracted": True,
                                "source": "opencv",
                            })

                        cap.release()
                        if keyframes:
                            return keyframes
                    cap.release()
            except Exception as err:
                print(f"[KeyframeExtractor] OpenCV extraction warning: {err}")

        # Secondary Fast Fallback: FFmpeg fast seek
        try:
            ffmpeg_bin = get_ffmpeg_bin()
            keyframes = []
            for i in range(count):
                sec = max(0, i * 30)
                thumb_name = f"{video_id}_kf_{i:02d}.jpg"
                thumb_path = os.path.join(output_dir, thumb_name)
                cmd = [
                    ffmpeg_bin, "-ss", str(sec), "-i", video_path,
                    "-vframes", "1", "-vf", "scale=640:-1", "-q:v", "3", "-y",
                    thumb_path
                ]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
                if os.path.exists(thumb_path):
                    keyframes.append({
                        "frame_index": i,
                        "timestamp_sec": sec,
                        "thumbnail_url": f"/uploads/thumbnails/{thumb_name}",
                        "extracted": True,
                        "source": "ffmpeg",
                    })
            if keyframes:
                return keyframes
        except Exception as e:
            print(f"[KeyframeExtractor] FFmpeg extraction warning: {e}")

        return self._get_placeholder_frames(video_path, count)

    def extract_cover_thumbnail(self, video_path: str, pre_extracted_keyframes: list = None) -> str:
        """
        Returns a single cover thumbnail URL.
        Reuses pre-extracted keyframes if provided, avoiding duplicate video decoding.
        """
        if pre_extracted_keyframes and len(pre_extracted_keyframes) > 0:
            idx = 1 if len(pre_extracted_keyframes) >= 2 else 0
            return pre_extracted_keyframes[idx].get("thumbnail_url", "")

        kfs = self.extract_keyframes(video_path, count=3)
        if kfs and len(kfs) >= 2:
            return kfs[1]["thumbnail_url"]
        return kfs[0]["thumbnail_url"] if kfs else ""


keyframe_extractor = KeyframeExtractor()

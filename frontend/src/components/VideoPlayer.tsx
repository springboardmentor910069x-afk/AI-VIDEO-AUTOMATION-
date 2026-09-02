import { forwardRef, useImperativeHandle, useRef, useState } from "react";

import { useMediaUrl } from "@/hooks/useMediaUrl";
import { FilmIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";
import type { Video } from "@/api/types";

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  video: Video;
  className?: string;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ video, className }, ref) {
    const ready = video.upload_status === "ready";
    const src = useMediaUrl(ready ? video.id : null, "media");
    const poster = useMediaUrl(video.thumbnail_path ? video.id : null, "thumbnail");
    const [failed, setFailed] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        seekTo(seconds: number) {
          const element = videoRef.current;
          if (!element) return;
          element.currentTime = Math.max(0, seconds);
          // Jumping to a moment is an explicit user intent to watch — play.
          void element.play().catch(() => {});
        },
      }),
      [],
    );

    if (failed || !src) {
      return (
        <div
          className={cn(
            "flex aspect-video w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-900 dark:border-slate-800",
            className,
          )}
        >
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <FilmIcon className="h-12 w-12" />
            {!ready ? (
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Video not ready yet
              </span>
            ) : (
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Video unavailable
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-card dark:border-slate-800",
          className,
        )}
      >
        <video
          ref={videoRef}
          className="aspect-video w-full"
          src={src}
          poster={poster ?? undefined}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  },
);

export default VideoPlayer;

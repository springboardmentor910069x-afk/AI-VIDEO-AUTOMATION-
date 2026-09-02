import { useEffect, useState } from "react";
import { buildMediaUrl } from "@/api/client";

/**
 * Resolves the authenticated URL for a video's media or thumbnail.
 * Returns null while loading or if the token could not be obtained, so callers
 * can render a placeholder instead of a broken media element.
 */
export function useMediaUrl(
  videoId: string | null | undefined,
  kind: "media" | "thumbnail",
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);

    if (!videoId) return;

    buildMediaUrl(videoId, kind).then((value) => {
      if (active) setUrl(value);
    });

    return () => {
      active = false;
    };
  }, [videoId, kind]);

  return url;
}

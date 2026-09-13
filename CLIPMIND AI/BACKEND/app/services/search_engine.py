import re
from typing import List, Dict, Any
from app.mongodb_models import Video, Transcript, Summary, KeyMoment

class SearchEngine:
    """
    Unified MongoDB Full-Text & Keyword Search Engine across Video Titles, Transcripts, Summaries, and Key Moments.
    """
    async def search(self, query: str, user_id: str = None) -> List[Dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return []

        q = query.lower().strip()
        results = []
        seen_keys = set()

        try:
            videos = await (Video.find_all() if not user_id else Video.find(Video.user_id == user_id)).to_list()
        except Exception:
            videos = []

        video_map = {str(v.id): v for v in videos}

        # 1. Search Video Titles & Metadata
        for v in videos:
            t = v.title or ""
            cat = v.category or ""
            dom = v.domain or ""
            if q in t.lower() or q in cat.lower() or q in dom.lower():
                key = f"title-{v.id}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append({
                        "video_id": str(v.id),
                        "video_title": t,
                        "type": "title",
                        "segment": t,
                        "timestamp": "00:00",
                        "timestamp_sec": 0,
                        "score": 0.99
                    })

        # 2. Search Transcripts
        try:
            transcripts = await Transcript.find_all().to_list()
            for tr in transcripts:
                vid = video_map.get(str(tr.video_id))
                v_title = vid.title if vid else "Video Asset"
                for seg in tr.segments:
                    text = seg.get("text", "")
                    if q in text.lower():
                        key = f"seg-{tr.video_id}-{seg.get('id', 0)}"
                        if key not in seen_keys:
                            seen_keys.add(key)
                            results.append({
                                "video_id": str(tr.video_id),
                                "video_title": v_title,
                                "type": "transcript",
                                "segment": text,
                                "timestamp": seg.get("timestamp", "00:00"),
                                "timestamp_sec": int(seg.get("start", 0)),
                                "score": 0.92
                            })
        except Exception as err:
            print(f"[Search Engine] Transcript search notice: {err}")

        # 3. Search Summaries
        try:
            summaries = await Summary.find_all().to_list()
            for sm in summaries:
                vid = video_map.get(str(sm.video_id))
                v_title = vid.title if vid else "Video Asset"
                
                # Check TLDR
                if q in sm.tldr.lower():
                    key = f"sum-tldr-{sm.video_id}"
                    if key not in seen_keys:
                        seen_keys.add(key)
                        results.append({
                            "video_id": str(sm.video_id),
                            "video_title": v_title,
                            "type": "summary",
                            "segment": sm.tldr[:200] + ("..." if len(sm.tldr) > 200 else ""),
                            "timestamp": "00:00",
                            "timestamp_sec": 0,
                            "score": 0.88
                        })

                # Check Sections
                for sec in sm.sections:
                    sec_title = sec.get("title", "")
                    sec_sum = sec.get("summary", "")
                    if q in sec_title.lower() or q in sec_sum.lower():
                        key = f"sum-sec-{sm.video_id}-{sec.get('id', '')}"
                        if key not in seen_keys:
                            seen_keys.add(key)
                            results.append({
                                "video_id": str(sm.video_id),
                                "video_title": v_title,
                                "type": "chapter",
                                "segment": f"{sec_title}: {sec_sum}",
                                "timestamp": sec.get("timeRange", "00:00").split(" - ")[0],
                                "timestamp_sec": 0,
                                "score": 0.85
                            })
        except Exception as err:
            print(f"[Search Engine] Summary search notice: {err}")

        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:30]

search_engine = SearchEngine()

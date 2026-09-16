"""
AI Mind Map Generator for ClipMind AI (inspired by clipmind.tech).
Transforms structured video summaries, chapters, and key moments into an
interactive, hierarchical concept tree with timestamped nodes.
"""

from typing import Dict, Any, List, Optional
import uuid

THEME_COLORS = [
    "#6366F1", # Indigo
    "#06B6D4", # Cyan
    "#10B981", # Emerald
    "#F59E0B", # Amber
    "#EC4899", # Pink
    "#8B5CF6", # Violet
]

def parse_time_str(t_str: str) -> int:
    """Parses 'MM:SS' or 'HH:MM:SS' into integer seconds."""
    if not t_str:
        return 0
    clean = t_str.split("-")[0].strip() # If range like '00:15 - 01:20', take start
    parts = clean.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(float(parts[1]))
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
    except Exception:
        return 0
    return 0

class MindMapService:
    def build_mindmap(
        self,
        video_title: str,
        summary_sections: List[Dict[str, Any]],
        key_moments: List[Dict[str, Any]],
        key_takeaways: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes an interactive hierarchical mind map from video intelligence assets.
        """
        root_id = f"node-root-{uuid.uuid4().hex[:6]}"
        root_node: Dict[str, Any] = {
            "id": root_id,
            "label": video_title or "Lecture Concept Overview",
            "type": "root",
            "timestamp": "00:00",
            "timestamp_sec": 0,
            "color": "#6366F1",
            "children": []
        }

        # 1. Main chapter branches (Level 1)
        sections = summary_sections or []
        if not sections:
            sections = [
                {
                    "title": "Core Foundations & Concepts",
                    "timeRange": "00:00 - 02:00",
                    "summary": "Key foundational ideas presented in the lecture.",
                    "bulletPoints": key_takeaways[:3] if key_takeaways else ["Introduction of core terms"]
                }
            ]

        for idx, sec in enumerate(sections):
            time_range = sec.get("timeRange") or sec.get("timestamp_range") or "00:00"
            start_sec = parse_time_str(time_range)
            branch_color = THEME_COLORS[idx % len(THEME_COLORS)]
            branch_id = f"branch-{idx + 1}"

            chapter_node: Dict[str, Any] = {
                "id": branch_id,
                "label": sec.get("title") or sec.get("heading") or f"Topic {idx + 1}",
                "type": "chapter",
                "timestamp": time_range.split("-")[0].strip() if "-" in time_range else time_range,
                "timestamp_sec": start_sec,
                "summary": sec.get("summary", ""),
                "color": branch_color,
                "children": []
            }

            # 2. Key Moments mapped to this chapter (Level 2)
            # Find moments that fall into this time boundary
            next_sec = sections[idx + 1] if idx + 1 < len(sections) else None
            next_start_sec = parse_time_str(next_sec.get("timeRange", "")) if next_sec else 999999

            matching_moments = [
                m for m in (key_moments or [])
                if start_sec <= (m.get("timestamp") or 0) < next_start_sec
            ]

            for m_idx, km in enumerate(matching_moments):
                sec_val = int(km.get("timestamp") or 0)
                m_node: Dict[str, Any] = {
                    "id": f"km-{idx}-{m_idx}",
                    "label": km.get("title") or "Key Visual Shift",
                    "type": "moment",
                    "timestamp": km.get("timestamp_str") or "00:00",
                    "timestamp_sec": sec_val,
                    "importance": km.get("importance_score", 0.8),
                    "color": branch_color,
                    "children": []
                }
                chapter_node["children"].append(m_node)

            # 3. Takeaway bullet points for this chapter (Level 2 / 3)
            bullets = sec.get("bulletPoints") or sec.get("points") or []
            for b_idx, bullet in enumerate(bullets[:4]):
                clean_bullet = str(bullet).strip()
                if clean_bullet:
                    # Estimate timestamp relative to chapter
                    offset_sec = start_sec + (b_idx * 20)
                    b_node: Dict[str, Any] = {
                        "id": f"bullet-{idx}-{b_idx}",
                        "label": clean_bullet,
                        "type": "concept",
                        "timestamp": f"{offset_sec // 60:02d}:{offset_sec % 60:02d}",
                        "timestamp_sec": offset_sec,
                        "color": branch_color,
                        "children": []
                    }
                    chapter_node["children"].append(b_node)

            root_node["children"].append(chapter_node)

        # 4. If key takeaways exist, add a synthesis branch
        if key_takeaways and len(key_takeaways) > 0:
            synth_node: Dict[str, Any] = {
                "id": "branch-takeaways",
                "label": "🎯 Critical Conclusions & Mastery",
                "type": "summary",
                "timestamp": "Summary",
                "timestamp_sec": 0,
                "color": "#10B981",
                "children": [
                    {
                        "id": f"takeaway-{t_idx}",
                        "label": str(t),
                        "type": "takeaway",
                        "timestamp": "Key Point",
                        "timestamp_sec": 0,
                        "color": "#10B981",
                        "children": []
                    }
                    for t_idx, t in enumerate(key_takeaways[:4])
                ]
            }
            root_node["children"].append(synth_node)

        return root_node


mindmap_service = MindMapService()

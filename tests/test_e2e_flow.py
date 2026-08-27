import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import json

BASE_URL = "http://127.0.0.1:8000"

def test_full_platform_flow():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health error: {res.text}"
    print("[PASS] 1. Health check:", res.json())

    # 2. Authentication: Register creator and learner
    creator_email = "creator_test@clipmind.ai"
    learner_email = "learner_test@clipmind.ai"
    
    # Login or register creator
    res = client.post("/api/auth/login", json={"email": creator_email, "password": "Password123!"})
    if res.status_code != 200:
        res = client.post("/api/auth/register", json={
            "name": "Test Creator",
            "email": creator_email,
            "password": "Password123!",
            "role": "creator"
        })
    assert res.status_code == 200 or res.status_code == 201, f"Auth failed: {res.text}"
    creator_token = res.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    print("[PASS] 2. Creator Authenticated:", res.json()["user"]["name"])

    # Login or register learner
    res = client.post("/api/auth/login", json={"email": learner_email, "password": "Password123!"})
    if res.status_code != 200:
        res = client.post("/api/auth/register", json={
            "name": "Test Learner",
            "email": learner_email,
            "password": "Password123!",
            "role": "learner"
        })
    learner_token = res.json()["access_token"]
    learner_headers = {"Authorization": f"Bearer {learner_token}"}
    print("[PASS] 3. Learner Authenticated:", res.json()["user"]["name"])

    # 3. Video List (Learners and Admins can see all videos in library)
    res = client.get("/api/videos", headers=learner_headers)
    assert res.status_code == 200
    videos = res.json()
    print(f"[PASS] 4. Accessible videos count: {len(videos)}")
    assert len(videos) > 0, "Expected at least one video in library"
    video_id = videos[0]["id"]
    video_name = videos[0]["original_name"]
    print(f"   Selected video: {video_name} ({video_id})")

    # 4. Stream endpoint test (Range seeking)
    res = client.get(f"/api/videos/{video_id}/stream", headers={"Range": "bytes=0-1024"})
    assert res.status_code == 206, f"Stream error: {res.status_code}"
    assert "bytes 0-1024/" in res.headers.get("Content-Range", "")
    print(f"[PASS] 5. Video Stream Range Seeking functional (HTTP 206, {len(res.content)} bytes)")

    # 5. Key Moments Detection (Milestone 3)
    res = client.get(f"/api/videos/{video_id}/key-moments", headers=learner_headers)
    assert res.status_code == 200
    moments = res.json()
    assert len(moments) > 0, "Expected key moments"
    print(f"[PASS] 6. Key Moments detected: {len(moments)} moments")
    sample_m = moments[0]
    print(f"   Sample Moment: [{sample_m['formatted_time']}] {sample_m['label']} | Category: {sample_m['category']} | Score: {sample_m['importance_score']}")

    # 6. Keyword & Topic Extraction (Milestone 3)
    res = client.get(f"/api/videos/{video_id}/keywords", headers=learner_headers)
    assert res.status_code == 200
    keywords = res.json()
    assert len(keywords) > 0, "Expected keywords"
    print(f"[PASS] 7. Keywords Extracted: {len(keywords)} terms (Top: {[k['keyword'] for k in keywords[:4]]})")

    # 7. Content Insights & Speech Pace (Milestone 3)
    res = client.get(f"/api/videos/{video_id}/insights", headers=learner_headers)
    assert res.status_code == 200
    insights = res.json()
    print(f"[PASS] 8. Content Insights: Pace: {insights['speaking_pace_wpm']} WPM ({insights['pace_rating']}) | Complexity: {insights['complexity_level']} | Sentiment: {insights['sentiment_tone']}")

    # 8. Transcript In-Text Search with timestamps (Milestone 3)
    res = client.get(f"/api/videos/{video_id}/search?q=the", headers=learner_headers)
    assert res.status_code == 200
    search_data = res.json()
    assert search_data["total_matches"] > 0
    print(f"[PASS] 9. Transcript Search: {search_data['total_matches']} matches with timestamps for 'the'")

    # 9. Highlight Report (Milestone 3)
    res = client.get(f"/api/videos/{video_id}/report", headers=learner_headers)
    assert res.status_code == 200
    report = res.json()
    assert "title" in report and len(report["takeaways"]) > 0
    print(f"[PASS] 10. Executive Highlight Report: {report['title']} with {len(report['takeaways'])} key takeaways")

    # 10. Export formats (Milestone 3)
    for fmt in ["md", "txt", "srt", "vtt", "json"]:
        res = client.get(f"/api/videos/{video_id}/export?format={fmt}", headers=learner_headers)
        assert res.status_code == 200, f"Export {fmt} failed"
        print(f"[PASS] 11.{fmt.upper()} Export valid: {len(res.content)} bytes")

    # 11. Learner Bookmarking (Milestone 3)
    res = client.post("/api/bookmarks", headers=learner_headers, json={
        "video_id": video_id,
        "item_type": "key_moment",
        "title": sample_m["label"],
        "content": sample_m["summary"],
        "timestamp_start": sample_m["start_time"],
        "timestamp_end": sample_m["end_time"]
    })
    assert res.status_code == 201
    bm_id = res.json()["id"]
    print(f"[PASS] 12. Learner Bookmark Created: {bm_id}")

    res = client.get("/api/bookmarks", headers=learner_headers)
    assert res.status_code == 200 and len(res.json()) >= 1
    print(f"[PASS] 13. Learner Bookmarks Listed: {len(res.json())} bookmarks")

    # 12. Role-Based Analytics Dashboards (Milestone 3)
    res = client.get("/api/analytics/creator", headers=creator_headers)
    assert res.status_code == 200
    print(f"[PASS] 14. Creator Analytics: {res.json()['total_uploads']} uploads, {res.json()['total_duration_minutes']} min duration")

    res = client.get("/api/analytics/learner", headers=learner_headers)
    assert res.status_code == 200
    print(f"[PASS] 15. Learner Analytics: {res.json()['total_bookmarks']} bookmarks, {res.json()['videos_explored']} videos explored")

    # Admin analytics with admin account
    admin_email = "admin_test@clipmind.ai"
    res = client.post("/api/auth/login", json={"email": admin_email, "password": "Password123!"})
    if res.status_code != 200:
        res = client.post("/api/auth/register", json={
            "name": "System Administrator",
            "email": admin_email,
            "password": "Password123!",
            "role": "admin"
        })
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/analytics/system", headers=admin_headers)
    assert res.status_code == 200
    sys_an = res.json()
    print(f"[PASS] 16. Admin System Analytics: {sys_an['total_users']} users, {sys_an['total_videos']} videos, {sys_an['total_storage_mb']} MB storage")

    res = client.get("/api/admin/users", headers=admin_headers)
    assert res.status_code == 200
    print(f"[PASS] 17. Admin User Management: {len(res.json())} registered accounts")

    res = client.get("/api/admin/activity", headers=admin_headers)
    assert res.status_code == 200
    print(f"[PASS] 18. Admin Audit Trail: {len(res.json())} recorded activity logs")

    print("\n=======================================================")
    print("ALL 18 END-TO-END MILESTONE 3 FLOWS VERIFIED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_full_platform_flow()

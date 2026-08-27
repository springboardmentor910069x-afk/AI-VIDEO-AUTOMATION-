import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import sqlite3
import jwt
import json
from fastapi.testclient import TestClient
from app.main import app, JWT_SECRET, db

def run_tests():
    client = TestClient(app)

    with db() as c:
        user = c.execute("SELECT * FROM users WHERE role = 'admin'").fetchone()
        if not user:
            user = c.execute("SELECT * FROM users LIMIT 1").fetchone()
        user_id = user['id']
        role = user['role']

    token = jwt.encode({'sub': user_id, 'role': role}, JWT_SECRET, algorithm='HS256')
    headers = {'Authorization': f'Bearer {token}'}

    # Health
    res = client.get('/api/health')
    assert res.status_code == 200, f"Health failed: {res.text}"
    print("[PASS] Health check OK:", res.json())

    # List videos
    res = client.get('/api/videos', headers=headers)
    assert res.status_code == 200
    videos = res.json()
    print(f"[PASS] Video list OK: found {len(videos)} videos")

    if videos:
        vid = videos[0]['id']
        print(f"Testing video: {vid}")

        # Transcript
        res = client.get(f'/api/videos/{vid}/transcript', headers=headers)
        print(f"[PASS] Transcript status {res.status_code}, length: {len(res.json().get('content', ''))}")

        # Key Moments
        res = client.get(f'/api/videos/{vid}/key-moments', headers=headers)
        assert res.status_code == 200
        moments = res.json()
        print(f"[PASS] Key moments OK: {len(moments)} moments extracted")
        if moments:
            print(f"  First moment: [{moments[0]['formatted_time']}] {moments[0]['label']} (Score: {moments[0]['importance_score']})")

        # Keywords
        res = client.get(f'/api/videos/{vid}/keywords', headers=headers)
        assert res.status_code == 200
        keywords = res.json()
        print(f"[PASS] Keywords OK: {len(keywords)} keywords extracted")
        if keywords:
            print(f"  Top keywords: {[k['keyword'] for k in keywords[:5]]}")

        # Insights
        res = client.get(f'/api/videos/{vid}/insights', headers=headers)
        assert res.status_code == 200
        insights = res.json()
        print(f"[PASS] Content insights OK: {insights['speaking_pace_wpm']} WPM ({insights['pace_rating']}), {insights['complexity_level']}, {insights['sentiment_tone']}")

        # Search
        res = client.get(f'/api/videos/{vid}/search?q=the', headers=headers)
        assert res.status_code == 200
        print(f"[PASS] Search OK: {res.json()['total_matches']} matches for 'the'")

        # Report
        res = client.get(f'/api/videos/{vid}/report', headers=headers)
        assert res.status_code == 200
        print(f"[PASS] Highlight report OK: {res.json()['title']}")

        # Export MD
        res = client.get(f'/api/videos/{vid}/export?format=md', headers=headers)
        assert res.status_code == 200
        print(f"[PASS] Export Markdown OK: {len(res.text)} bytes")

        # Export SRT
        res = client.get(f'/api/videos/{vid}/export?format=srt', headers=headers)
        assert res.status_code == 200
        print(f"[PASS] Export SRT OK: {len(res.text)} bytes")

        # Bookmarks test
        res = client.post('/api/bookmarks', headers=headers, json={
            'video_id': vid,
            'item_type': 'key_moment',
            'title': 'Test Key Moment',
            'content': 'Important segment to review later',
            'timestamp_start': 10.5,
            'timestamp_end': 25.0
        })
        assert res.status_code == 201
        bm = res.json()
        print(f"[PASS] Create bookmark OK: {bm['id']}")

        res = client.get('/api/bookmarks', headers=headers)
        assert res.status_code == 200
        print(f"[PASS] List bookmarks OK: {len(res.json())} bookmarks")

        # Cleanup bookmark
        res = client.delete(f"/api/bookmarks/{bm['id']}", headers=headers)
        assert res.status_code == 204
        print("[PASS] Delete bookmark OK")

    # Analytics for all roles
    res = client.get('/api/analytics/system', headers=headers)
    assert res.status_code == 200
    print(f"[PASS] System analytics OK: {res.json()['total_users']} users, {res.json()['total_videos']} videos")

    res = client.get('/api/analytics/creator', headers=headers)
    assert res.status_code == 200
    print(f"[PASS] Creator analytics OK: {res.json()['total_uploads']} uploads")

    res = client.get('/api/analytics/educator', headers=headers)
    assert res.status_code == 200
    print(f"[PASS] Educator analytics OK: {res.json()['total_lectures']} lectures")

    res = client.get('/api/analytics/learner', headers=headers)
    assert res.status_code == 200
    print(f"[PASS] Learner analytics OK: {res.json()['total_bookmarks']} bookmarks")

    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()

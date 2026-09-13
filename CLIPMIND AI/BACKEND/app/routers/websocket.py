from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.pipeline import active_websockets

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/videos/{video_id}/status")
async def websocket_video_status(websocket: WebSocket, video_id: str):
    await websocket.accept()
    if video_id not in active_websockets:
        active_websockets[video_id] = []
    active_websockets[video_id].append(websocket)
    
    try:
        while True:
            # Keep connection open and receive optional client heartbeats
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        if video_id in active_websockets and websocket in active_websockets[video_id]:
            active_websockets[video_id].remove(websocket)

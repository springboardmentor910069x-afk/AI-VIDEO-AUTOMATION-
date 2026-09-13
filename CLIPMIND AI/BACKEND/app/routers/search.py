from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.mongodb_models import User
from app.security import get_current_user
from app.services.search_engine import search_engine

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("")
async def search_transcripts_and_summaries(
    q: str = Query(..., min_length=1, description="Search query string"),
    current_user: User = Depends(get_current_user)
):
    user_id = str(getattr(current_user, "id", "demo-user"))
    results = await search_engine.search(query=q, user_id=user_id)
    return {"query": q, "total_matches": len(results), "results": results}

@router.post("/semantic")
async def semantic_search(
    body: dict,
    current_user: User = Depends(get_current_user)
):
    user_id = str(getattr(current_user, "id", "demo-user"))
    query_text = body.get("query", "")
    results = await search_engine.search(query=query_text, user_id=user_id)
    return {"query": query_text, "matches": results}

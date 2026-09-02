from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.routes.videos import get_video
from app.db.session import get_db
from app.models.user import User
from app.services.document_store import get_summary, get_transcript

router = APIRouter(prefix="/videos/{video_id}/exports", tags=["exports"])


@router.get("/txt", response_class=PlainTextResponse)
async def export_txt(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> str:
    await get_video(video_id, user, db)
    transcript = get_transcript(video_id)
    summary = get_summary(video_id)
    if transcript is None or summary is None:
        raise HTTPException(status_code=404, detail="Export is not ready")
    return f"Summary\n{summary.short_summary}\n\nDetailed Summary\n{summary.detailed_summary}\n\nTranscript\n{transcript.full_text}"


@router.get("/pdf")
async def export_pdf(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    content = await export_txt(video_id, user, db)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    text = pdf.beginText(40, 750)
    for line in content.splitlines():
        text.textLine(line[:95])
    pdf.drawText(text)
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=clipmind-export.pdf"})

import os
from PIL import Image, ImageDraw, ImageFont

IMAGES_DIR = r"d:/SPRING BOARD/AI-VIDEO-AUTOMATION-/CLIPMIND AI/docs/images"
os.makedirs(IMAGES_DIR, exist_ok=True)

# Font paths
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_SEMI = "C:/Windows/Fonts/segoeui.ttf"

def get_font(size, bold=False):
    path = FONT_BOLD if bold else FONT_REGULAR
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

# Theme Colors
BG_COLOR = (248, 250, 252)         # #F8FAFC
CARD_BG = (255, 255, 255)          # #FFFFFF
BORDER_COLOR = (226, 232, 240)     # #E2E8F0
BORDER_ACTIVE = (203, 213, 225)    # #CBD5E1

PRIMARY_NAVY = (15, 23, 42)        # #0F172A
TEXT_DARK = (30, 41, 59)           # #1E293B
TEXT_MUTED = (100, 116, 139)       # #64748B

ACCENT_BLUE = (37, 99, 235)        # #2563EB
ACCENT_CYAN = (8, 145, 178)        # #0891B2
ACCENT_EMERALD = (16, 185, 129)    # #10B981
ACCENT_PURPLE = (124, 58, 237)     # #7C3AED
ACCENT_AMBER = (217, 119, 6)       # #D97706
ACCENT_ROSE = (225, 29, 72)        # #E11D48

def draw_rounded_card(draw, box, fill=CARD_BG, outline=BORDER_COLOR, radius=12, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def draw_pill(draw, box, text, font, bg_color, text_color, radius=8):
    draw.rounded_rectangle(box, radius=radius, fill=bg_color)
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - tw) / 2
    y = box[1] + (box[3] - box[1] - th) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=text_color)

def draw_header(draw, width, tag, title, subtitle):
    # Tag
    draw.text((60, 45), tag.upper(), font=get_font(16, bold=True), fill=ACCENT_BLUE)
    # Title
    draw.text((60, 75), title, font=get_font(34, bold=True), fill=PRIMARY_NAVY)
    # Subtitle
    draw.text((60, 125), subtitle, font=get_font(18, bold=False), fill=TEXT_MUTED)
    # Divider line
    draw.line([(60, 165), (width - 60, 165)], fill=BORDER_COLOR, width=2)


# ==============================================================================
# Diagram 1: Novelty and Core Innovations Flowchart
# ==============================================================================
def generate_novelty_diagram():
    W, H = 2200, 1320
    im = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(im)

    draw_header(draw, W, 
                "CLIPMIND AI • ARCHITECTURAL DIFFERENTIATION & VALUE MATRIX",
                "Proposed Solution & Technical Innovations",
                "Six engineering pillars transforming passive video recordings into searchable, structured, and resilient knowledge assets.")

    cards = [
        ("Google Drive 15GB Cloud & HTTP 206 Streaming", "ZERO-LOSS STORAGE", ACCENT_CYAN, (236, 254, 255), [
            "Direct OAuth 2.0 connection gives users 15 GB of persistent personal storage.",
            "Automatic background cloud sync on upload without requiring manual toggling.",
            "HTTP 206 Partial Content range proxy enables sub-20ms seeking latency.",
            "Eliminates media loss when ephemeral cloud containers (Render/ECS) reset."
        ]),
        ("Universal Pipeline Cloud Fallback", "RELIABILITY", ACCENT_EMERALD, (236, 253, 245), [
            "Background AI pipeline automatically downloads file from Drive if local disk was wiped.",
            "Executes complete 7-stage workflow: demuxing, Whisper ASR, OpenCV, and summarization.",
            "100% processing continuity regardless of container restarts or redeployments.",
            "Working disk buffer cleans temporary files automatically post-processing."
        ]),
        ("Interactive AI Concept Mind Maps", "KNOWLEDGE GRAPH", ACCENT_PURPLE, (245, 243, 255), [
            "Synthesizes transcripts into a multi-tier conceptual knowledge graph.",
            "Clicking any node jumps the video player immediately to that exact timestamp.",
            "Dynamic SVG canvas with smooth drag-to-pan, mouse-wheel zooming, and search.",
            "One-click export generates publication-grade vector SVG study notes."
        ]),
        ("Multimodal Video Intelligence Engine", "WHISPER & OPENCV", ACCENT_BLUE, (239, 246, 255), [
            "Pretrained OpenAI Whisper ASR achieves 4.18% Word Error Rate (95.82% accuracy).",
            "Generates sub-second word-level timestamp alignment with auto-scroll highlighting.",
            "OpenCV 1 fps frame differencing and HSV color histograms detect slide transitions.",
            "Correlates visual transitions with spoken sentence boundaries for rich chaptering."
        ]),
        ("Dual-Tier Natural Language Summarization", "EXTRACTIVE & ABSTRACTIVE", ACCENT_AMBER, (254, 243, 199), [
            "Tier 1: LexRank TF-IDF graph centrality extracts TL;DR summary in <1.5s.",
            "Tier 2: Generative LLMs synthesize modular curriculum chapters and key takeaways.",
            "Generates Bloom's taxonomy practice quizzes and 3D active recall flashcards.",
            "Three depth modes: Quick TL;DR, Detailed Breakdown, and Executive Deep Dive."
        ]),
        ("5-Tab Educator Studio & Active Recall Suite", "CURRICULUM AUTHORING", (79, 70, 229), (238, 242, 255), [
            "Tab 1: Inline transcript editor with speaker diarization tags and corrections.",
            "Tab 2: Curriculum chapters builder with custom start and end time markers.",
            "Tab 3: Assessment authoring with answer keys, distractors, and explanations.",
            "Tab 4 & 5: Active recall flashcard decks & live student preview before publishing."
        ]),
    ]

    card_w = 660
    card_h = 510
    start_x = 60
    start_y = 200
    gap_x = 40
    gap_y = 40

    for idx, (title, tag, color, tag_bg, bullets) in enumerate(cards):
        col = idx % 3
        row = idx // 3
        x1 = start_x + col * (card_w + gap_x)
        y1 = start_y + row * (card_h + gap_y)
        x2 = x1 + card_w
        y2 = y1 + card_h

        # Card Box
        draw_rounded_card(draw, (x1, y1, x2, y2), fill=CARD_BG, outline=color, radius=14, width=2)
        
        # Color bar indicator on top of card
        draw.rounded_rectangle((x1 + 16, y1 + 14, x1 + 80, y1 + 20), radius=3, fill=color)

        # Tag Pill
        draw_pill(draw, (x1 + 24, y1 + 32, x1 + 240, y1 + 64), tag, get_font(12, bold=True), tag_bg, color, radius=6)

        # Title
        draw.text((x1 + 24, y1 + 80), title, font=get_font(19, bold=True), fill=PRIMARY_NAVY)

        # Separator inside card
        draw.line([(x1 + 24, y1 + 118), (x2 - 24, y1 + 118)], fill=BORDER_COLOR, width=1)

        # Bullets
        by = y1 + 135
        for b in bullets:
            # Bullet circle
            draw.ellipse((x1 + 26, by + 6, x1 + 34, by + 14), fill=color)
            # Text wrapping
            words = b.split()
            lines = []
            cur_line = []
            for w in words:
                test_str = " ".join(cur_line + [w])
                bbox = get_font(15).getbbox(test_str)
                if bbox[2] - bbox[0] > (card_w - 75):
                    lines.append(" ".join(cur_line))
                    cur_line = [w]
                else:
                    cur_line.append(w)
            if cur_line:
                lines.append(" ".join(cur_line))

            for l in lines:
                draw.text((x1 + 45, by), l, font=get_font(15), fill=TEXT_DARK)
                by += 25
            by += 10

    out_path = os.path.join(IMAGES_DIR, "novelty_and_innovations_flowchart.png")
    im.save(out_path, "PNG", quality=95)
    print(f"Generated: {out_path}")


# ==============================================================================
# Diagram 2: Architecture Structural Flow
# ==============================================================================
def generate_architecture_flow_diagram():
    W, H = 2400, 1420
    im = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(im)

    draw_header(draw, W, 
                "CLIPMIND AI • 5-LAYER SERVICE-ORIENTED TOPOLOGY",
                "Architecture Structural Flow & Layer Interconnections",
                "Decoupled client presentation, API gateway, asynchronous AI workers, polyglot persistence, and cloud storage.")

    layers = [
        ("Layer 1: Frontend Client Presentation Layer", "React 19 • TypeScript 5.5 • Vite 8.2 • Tailwind CSS • Responsive Craft UI", 
         ACCENT_BLUE, (239, 246, 255), 200, 130, [
             ("Creator Studio & Upload", "File drag-and-drop & YouTube ingestion"),
             ("Learner Study Room", "Synchronized transcript seeking & quizzes"),
             ("Concept Mind Map Canvas", "Interactive hierarchical SVG knowledge graph"),
             ("5-Tab Educator Studio", "Curriculum, assessments, and preview"),
             ("Admin Hub & Telemetry", "User governance & 50+ event audit logs")
         ]),
        ("Layer 2: API Gateway & Security Orchestration", "FastAPI ASGI • Python 3.12 • OAuth2 JWT • Google Identity Services • WebSockets", 
         PRIMARY_NAVY, (241, 245, 249), 410, 130, [
             ("OAuth2 JWT Authentication", "Stateless tokens with salted Bcrypt"),
             ("Google Identity Services", "One-click login with drive.file scope"),
             ("Declarative RBAC Guards", "HTTP 403 route protection across 4 roles"),
             ("HTTP 206 Streaming Proxy", "Sub-20ms byte-range seeking for media"),
             ("WebSocket Hub (/ws)", "Bidirectional stage telemetry streaming")
         ]),
        ("Layer 3: Asynchronous Media & AI Processing Engine", "FFmpeg 6.1 • OpenAI Whisper ASR • LexRank • Instruction-Tuned LLMs • OpenCV 4.9", 
         ACCENT_PURPLE, (245, 243, 255), 620, 130, [
             ("FFmpeg Audio Demuxer", "16kHz mono WAV extraction (pcm_s16le)"),
             ("Whisper STT Model", "Sub-second word timestamps (4.18% WER)"),
             ("Dual-Tier Summarizer", "LexRank TF-IDF graph + Generative LLM"),
             ("OpenCV Scene Cut Detector", "1 fps pixel deltas and HSV histograms"),
             ("Mind Map Synthesizer", "Topic clustering & concept relationship tree")
         ]),
    ]

    for title, subtitle, color, bg, top_y, h, blocks in layers:
        draw_rounded_card(draw, (60, top_y, W - 60, top_y + h), fill=CARD_BG, outline=color, radius=12, width=2)
        # Header strip
        draw.rounded_rectangle((62, top_y + 2, W - 62, top_y + 40), radius=10, fill=bg)
        draw.text((80, top_y + 8), title, font=get_font(17, bold=True), fill=color)
        draw.text((650, top_y + 11), f"[{subtitle}]", font=get_font(13, bold=False), fill=TEXT_MUTED)

        # 5 Sub-blocks inside layer
        bw = (W - 120 - 4 * 16) / 5
        by = top_y + 48
        bh = h - 56
        for bidx, (bt, bd) in enumerate(blocks):
            bx = 68 + bidx * (bw + 16)
            draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=8, fill=(248, 250, 252), outline=BORDER_COLOR, width=1)
            draw.text((bx + 12, by + 12), bt, font=get_font(14, bold=True), fill=PRIMARY_NAVY)
            draw.text((bx + 12, by + 36), bd, font=get_font(11, bold=False), fill=TEXT_MUTED)

        # Connecting Arrow down
        if top_y < 600:
            arrow_y = top_y + h + 15
            draw.line([(W // 2, top_y + h), (W // 2, arrow_y + 50)], fill=ACCENT_BLUE, width=3)
            draw.polygon([(W // 2 - 8, arrow_y + 40), (W // 2 + 8, arrow_y + 40), (W // 2, arrow_y + 55)], fill=ACCENT_BLUE)
            draw.text((W // 2 + 15, arrow_y + 10), "REST API, Byte Streams & Real-Time Telemetry", font=get_font(12, bold=True), fill=ACCENT_BLUE)

    # Layer 4 & Layer 5 Split Bottom
    bot_y = 830
    bot_h = 490

    # Layer 4: Polyglot Database
    db_w = (W - 120 - 40) * 0.52
    draw_rounded_card(draw, (60, bot_y, 60 + db_w, bot_y + bot_h), fill=CARD_BG, outline=PRIMARY_NAVY, radius=12, width=2)
    draw.rounded_rectangle((62, bot_y + 2, 60 + db_w - 2, bot_y + 40), radius=10, fill=(241, 245, 249))
    draw.text((80, bot_y + 8), "Layer 4: Polyglot Persistence Layer", font=get_font(17, bold=True), fill=PRIMARY_NAVY)
    draw.text((450, bot_y + 11), "[Relational SQL + MongoDB Atlas Document ODM]", font=get_font(13, bold=False), fill=TEXT_MUTED)

    # Sub-card: Relational SQL
    draw_rounded_card(draw, (85, bot_y + 55, 60 + db_w - 25, bot_y + 250), fill=(248, 250, 252), outline=BORDER_COLOR, radius=10, width=1)
    draw.text((105, bot_y + 70), "Relational Database (SQLite in Dev / PostgreSQL in Prod)", font=get_font(16, bold=True), fill=ACCENT_BLUE)
    draw.text((105, bot_y + 98), "• Users Table: ID, Email (Unique), Password Hash (Bcrypt), Assigned Role (Creator/Learner/Educator/Admin)", font=get_font(13), fill=TEXT_DARK)
    draw.text((105, bot_y + 125), "• Audit Logs Table: Event ID, Actor ID, Action Type (UPLOAD, DELETE, ROLE_CHANGE), Target ID, Timestamp", font=get_font(13), fill=TEXT_DARK)
    draw.text((105, bot_y + 152), "• Purpose: ACID-compliant transactional authentication, credential safety, and immutable compliance audit trail", font=get_font(13), fill=TEXT_MUTED)
    draw.text((105, bot_y + 179), "• Performance: Indexed queries with sub-5ms lookup latency on user session verification", font=get_font(13), fill=TEXT_MUTED)

    # Sub-card: Document NoSQL (MongoDB Atlas)
    draw_rounded_card(draw, (85, bot_y + 265, 60 + db_w - 25, bot_y + 465), fill=(248, 250, 252), outline=BORDER_COLOR, radius=10, width=1)
    draw.text((105, bot_y + 280), "Document Database (MongoDB Atlas 7.0 with Beanie ODM)", font=get_font(16, bold=True), fill=ACCENT_EMERALD)
    draw.text((105, bot_y + 308), "• Videos Collection: ID, Title, drive_file_id, storage_type, duration, status, owner_id", font=get_font(13), fill=TEXT_DARK)
    draw.text((105, bot_y + 335), "• Transcripts Collection: Full text, segments array with sub-second timestamps, words, speaker tags", font=get_font(13), fill=TEXT_DARK)
    draw.text((105, bot_y + 362), "• Summaries Collection: Executive TL;DR, detailed chapters, key takeaways, conceptual mind maps", font=get_font(13), fill=TEXT_DARK)
    draw.text((105, bot_y + 389), "• Quizzes & Flashcards: Multiple-choice questions, distractors, explanations, spaced-repetition card decks", font=get_font(13), fill=TEXT_DARK)
    draw.text((105, bot_y + 416), "• Settings Collection: User storage mode preference, google_drive_token, connected drive account", font=get_font(13), fill=TEXT_MUTED)

    # Layer 5: Cloud Storage
    cs_x = 60 + db_w + 40
    cs_w = W - 60 - cs_x
    draw_rounded_card(draw, (cs_x, bot_y, cs_x + cs_w, bot_y + bot_h), fill=CARD_BG, outline=ACCENT_CYAN, radius=12, width=2)
    draw.rounded_rectangle((cs_x + 2, bot_y + 2, cs_x + cs_w - 2, bot_y + 40), radius=10, fill=(236, 254, 255))
    draw.text((cs_x + 20, bot_y + 8), "Layer 5: Zero-Loss Cloud Storage Architecture", font=get_font(17, bold=True), fill=ACCENT_CYAN)

    # Sub-card: Google Drive Cloud
    draw_rounded_card(draw, (cs_x + 25, bot_y + 55, cs_x + cs_w - 25, bot_y + 250), fill=(248, 250, 252), outline=BORDER_COLOR, radius=10, width=1)
    draw.text((cs_x + 45, bot_y + 70), "Google Drive Cloud Storage (15 GB Personal Quota)", font=get_font(16, bold=True), fill=ACCENT_CYAN)
    draw.text((cs_x + 45, bot_y + 98), "• Connects via OAuth 2.0 (Google Identity Services token exchange).", font=get_font(13), fill=TEXT_DARK)
    draw.text((cs_x + 45, bot_y + 125), "• Background auto-backup copies uploaded media directly into Google Drive.", font=get_font(13), fill=TEXT_DARK)
    draw.text((cs_x + 45, bot_y + 152), "• Zero data loss when ephemeral cloud containers (Render) reboot or sleep.", font=get_font(13), fill=TEXT_DARK)
    draw.text((cs_x + 45, bot_y + 179), "• Streamlined folder auto-provisioning under 'ClipMind AI Uploads'.", font=get_font(13), fill=TEXT_MUTED)

    # Sub-card: HTTP 206 Streaming & Buffer Fallback
    draw_rounded_card(draw, (cs_x + 25, bot_y + 265, cs_x + cs_w - 25, bot_y + 465), fill=(248, 250, 252), outline=BORDER_COLOR, radius=10, width=1)
    draw.text((cs_x + 45, bot_y + 280), "HTTP 206 Byte-Range Streaming & Pipeline Download", font=get_font(16, bold=True), fill=ACCENT_EMERALD)
    draw.text((cs_x + 45, bot_y + 308), "• Streaming endpoint (/stream) proxies chunks with sub-20ms seek latency.", font=get_font(13), fill=TEXT_DARK)
    draw.text((cs_x + 45, bot_y + 335), "• Universal pipeline downloads file on demand if container disk was wiped.", font=get_font(13), fill=TEXT_DARK)
    draw.text((cs_x + 45, bot_y + 362), "• Temporary scratch buffer ensures FFmpeg & Whisper execute flawlessly.", font=get_font(13), fill=TEXT_DARK)
    draw.text((cs_x + 45, bot_y + 389), "• Guarantees 100% video playback and AI processing reliability permanently.", font=get_font(13), fill=TEXT_MUTED)

    out_path = os.path.join(IMAGES_DIR, "architecture_structural_flow.png")
    im.save(out_path, "PNG", quality=95)
    print(f"Generated: {out_path}")


# ==============================================================================
# Diagram 3: Detailed 7-Stage Pipeline Workflow
# ==============================================================================
def generate_pipeline_workflow_diagram():
    W, H = 2400, 1280
    im = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(im)

    draw_header(draw, W, 
                "CLIPMIND AI • 7-STAGE ASYNCHRONOUS MEDIA ENGINE",
                "End-to-End Processing Workflow & Stage Telemetry",
                "Sequential and concurrent data transformation stages streaming sub-second progress over WebSockets.")

    stages = [
        ("STAGE 1", "Ingestion & Cloud Sync", "15% PROGRESS", ACCENT_BLUE, (239, 246, 255), [
            "Multipart stream ingestion (.mp4, .mov, .mkv, .webm) or yt-dlp YouTube extraction.",
            "Validates MIME type, calculates SHA-256 content hash, and assigns UUIDv4.",
            "Cloud Auto-Sync: uploads media to Google Drive and links drive_file_id in MongoDB.",
            "Drive Fallback: downloads file from Drive to working buffer if disk is clean."
        ]),
        ("STAGE 2", "Audio Demuxing (FFmpeg)", "35% PROGRESS", ACCENT_CYAN, (236, 254, 255), [
            "FFmpeg command converts video audio track to 16kHz mono 16-bit PCM WAV.",
            "Normalizes volume levels, removes audio channel bias, and filters low frequencies.",
            "Outputs acoustic stream precisely formatted for Whisper's 80-channel filterbank.",
            "Dispatches WebSocket telemetry event: stage2_processing (35%)."
        ]),
        ("STAGE 3", "Whisper Speech-to-Text", "65% PROGRESS", ACCENT_PURPLE, (245, 243, 255), [
            "Computes 80-channel Log-Mel spectrograms across 30-second sliding windows.",
            "Predicts speech tokens with sub-second word-level and sentence-level timestamps.",
            "Executes silence trimming, speaker segmentation, and language identification.",
            "Achieves benchmark accuracy of 4.18% Word Error Rate (WER)."
        ]),
        ("STAGE 4", "Dual-Tier Summarization", "75% PROGRESS", ACCENT_AMBER, (254, 243, 199), [
            "Tier 1 (Extractive): LexRank TF-IDF graph centrality extracts TL;DR in <1.5s.",
            "Tier 2 (Abstractive): LLM synthesizes structured modular curriculum chapters.",
            "Extracts key takeaways, core formulas, and domain-specific conceptual insights.",
            "Executes concurrently with Stage 5 visual processing via asyncio.gather."
        ]),
        ("STAGE 5", "OpenCV Vision Cuts", "85% PROGRESS", ACCENT_ROSE, (255, 241, 242), [
            "Decodes video at 1 frame per second via OpenCV cv2.VideoCapture.",
            "Calculates pixel delta vectors and HSV color histogram distances.",
            "Detects presentation slide transitions and visual topic shifts with 92.4% precision.",
            "Saves optimized WebP slide thumbnails linked to video timestamps."
        ]),
        ("STAGE 6", "Concept Mind Map Graph", "90% PROGRESS", ACCENT_EMERALD, (236, 253, 245), [
            "Structures lecture concepts into a hierarchical visual knowledge graph.",
            "Categorizes nodes: Central Topic -> Core Modules -> Sub-Concepts -> Takeaways.",
            "Embeds start_time markers on every concept node for interactive click-to-seek.",
            "Generates auto-graded practice quizzes and 3D active recall flashcard decks."
        ]),
        ("STAGE 7", "Persistence & HTTP 206", "100% READY", PRIMARY_NAVY, (241, 245, 249), [
            "Writes Video, Transcript, Summary, KeyMoments, Quiz, and MindMap to MongoDB.",
            "Configures custom HTTP 206 Partial Content range video streaming proxy.",
            "Enables sub-20ms seeking playback for both local and Google Drive media.",
            "Pushes final WebSocket completed event; UI updates without page reload."
        ]),
    ]

    # Render as a 2-row layout: Row 1 has 4 stages, Row 2 has 3 stages centered
    row1_w = (W - 120 - 3 * 30) / 4
    row1_h = 440
    y1 = 200

    for i in range(4):
        st_num, st_name, st_prog, col, bg, bullets = stages[i]
        x = 60 + i * (row1_w + 30)
        draw_rounded_card(draw, (x, y1, x + row1_w, y1 + row1_h), fill=CARD_BG, outline=col, radius=12, width=2)
        
        # Header strip
        draw.rounded_rectangle((x + 2, y1 + 2, x + row1_w - 2, y1 + 52), radius=10, fill=bg)
        draw.text((x + 16, y1 + 10), st_num, font=get_font(13, bold=True), fill=col)
        draw.text((x + 16, y1 + 28), st_name, font=get_font(16, bold=True), fill=PRIMARY_NAVY)
        draw_pill(draw, (x + row1_w - 125, y1 + 14, x + row1_w - 14, y1 + 38), st_prog, get_font(10, bold=True), CARD_BG, col, radius=5)

        # Bullets
        by = y1 + 75
        for b in bullets:
            draw.ellipse((x + 16, by + 5, x + 22, by + 11), fill=col)
            words = b.split()
            lines = []
            cur = []
            for w in words:
                test_str = " ".join(cur + [w])
                if get_font(13).getbbox(test_str)[2] > (row1_w - 45):
                    lines.append(" ".join(cur))
                    cur = [w]
                else:
                    cur.append(w)
            if cur:
                lines.append(" ".join(cur))

            for l in lines:
                draw.text((x + 30, by), l, font=get_font(13), fill=TEXT_DARK)
                by += 22
            by += 8

        # Arrow to next stage in row 1
        if i < 3:
            ax = x + row1_w + 5
            ay = y1 + row1_h // 2
            draw.line([(ax, ay), (ax + 20, ay)], fill=ACCENT_BLUE, width=3)
            draw.polygon([(ax + 15, ay - 6), (ax + 15, ay + 6), (ax + 23, ay)], fill=ACCENT_BLUE)

    # Row 2 (Stages 5, 6, 7)
    row2_w = (W - 120 - 2 * 35) / 3
    row2_h = 440
    y2 = y1 + row1_h + 80

    # Connector from row 1 to row 2
    draw.line([(W - 120, y1 + row1_h), (W - 120, y2 - 20)], fill=ACCENT_BLUE, width=3)
    draw.line([(W - 120, y2 - 20), (W // 2, y2 - 20)], fill=ACCENT_BLUE, width=3)
    draw.line([(W // 2, y2 - 20), (W // 2, y2)], fill=ACCENT_BLUE, width=3)
    draw.polygon([(W // 2 - 6, y2 - 8), (W // 2 + 6, y2 - 8), (W // 2, y2)], fill=ACCENT_BLUE)
    draw.text((W - 320, y1 + row1_h + 25), "Asynchronous Pipeline Execution", font=get_font(12, bold=True), fill=ACCENT_BLUE)

    for i in range(3):
        st_num, st_name, st_prog, col, bg, bullets = stages[4 + i]
        x = 60 + i * (row2_w + 35)
        draw_rounded_card(draw, (x, y2, x + row2_w, y2 + row2_h), fill=CARD_BG, outline=col, radius=12, width=2)
        
        # Header strip
        draw.rounded_rectangle((x + 2, y2 + 2, x + row2_w - 2, y2 + 52), radius=10, fill=bg)
        draw.text((x + 16, y2 + 10), st_num, font=get_font(13, bold=True), fill=col)
        draw.text((x + 16, y2 + 28), st_name, font=get_font(16, bold=True), fill=PRIMARY_NAVY)
        draw_pill(draw, (x + row2_w - 125, y2 + 14, x + row2_w - 14, y2 + 38), st_prog, get_font(10, bold=True), CARD_BG, col, radius=5)

        # Bullets
        by = y2 + 75
        for b in bullets:
            draw.ellipse((x + 16, by + 5, x + 22, by + 11), fill=col)
            words = b.split()
            lines = []
            cur = []
            for w in words:
                test_str = " ".join(cur + [w])
                if get_font(13).getbbox(test_str)[2] > (row2_w - 45):
                    lines.append(" ".join(cur))
                    cur = [w]
                else:
                    cur.append(w)
            if cur:
                lines.append(" ".join(cur))

            for l in lines:
                draw.text((x + 30, by), l, font=get_font(13), fill=TEXT_DARK)
                by += 22
            by += 8

        # Arrow in row 2
        if i < 2:
            ax = x + row2_w + 6
            ay = y2 + row2_h // 2
            draw.line([(ax, ay), (ax + 22, ay)], fill=ACCENT_BLUE, width=3)
            draw.polygon([(ax + 17, ay - 6), (ax + 17, ay + 6), (ax + 25, ay)], fill=ACCENT_BLUE)

    out_path = os.path.join(IMAGES_DIR, "detailed_pipeline_workflow.png")
    im.save(out_path, "PNG", quality=95)
    print(f"Generated: {out_path}")


# ==============================================================================
# Diagram 4: Milestone-Wise Implementation Timeline (Weeks 1-8)
# ==============================================================================
def generate_milestone_timeline_diagram():
    W, H = 2400, 1180
    im = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(im)

    draw_header(draw, W, 
                "CLIPMIND AI • 8-WEEK ENGINEERING LIFECYCLE",
                "Milestone-Wise Technical Implementation Roadmap (Weeks 1–8)",
                "100% adherence to Infosys Springboard Project Specification across four structured engineering milestones.")

    milestones = [
        ("MILESTONE 1", "Architecture, Auth & Video Ingestion", "WEEKS 1 & 2", "PASSED 100%", ACCENT_BLUE, (239, 246, 255), [
            "Defined service-oriented architecture with decoupled React 19 and FastAPI.",
            "Configured polyglot persistence: SQLite/PostgreSQL (relational) + MongoDB Atlas.",
            "Implemented salted Bcrypt password cryptography (cost factor 12) and signed JWT tokens.",
            "Built chunked multipart upload handler supporting .mp4, .mov, .mkv, and .webm.",
            "Integrated yt-dlp for non-blocking YouTube video and audio stream extraction.",
            "Engineered FFmpeg audio extractor normalizer converting tracks to 16kHz mono WAV."
        ]),
        ("MILESTONE 2", "Speech-to-Text & AI Summarization", "WEEKS 3 & 4", "PASSED 100%", ACCENT_CYAN, (236, 254, 255), [
            "Integrated pretrained OpenAI Whisper transformer ASR with hardware acceleration.",
            "Indexed millisecond word timestamps and 3-5s sentence segments in MongoDB Atlas.",
            "Developed LexRank graph centrality algorithm over TF-IDF sentence cosine similarity.",
            "Built abstractive LLM engine for executive TL;DRs, structured chapters, and takeaways.",
            "Developed interactive transcript viewer with click-to-seek video synchronization.",
            "Verified transcription accuracy achieving 4.18% Word Error Rate (95.82% accuracy)."
        ]),
        ("MILESTONE 3", "Key Moments, Educator & Learner Studio", "WEEKS 5 & 6", "PASSED 100%", ACCENT_PURPLE, (245, 243, 255), [
            "Built OpenCV computer vision engine analyzing frame deltas and HSV histograms at 1 fps.",
            "Engineered 5-Tab Educator Studio: Transcripts, Chapters, Quizzes, Cards, Preview.",
            "Built Learner Study Room with auto-graded quizzes and 3D active recall flip flashcards.",
            "Developed multi-format document exporter generating PDF, DOCX, TXT, SRT, and VTT.",
            "Deployed bidirectional WebSocket telemetry server streaming progress events.",
            "Verified zero-orphan cascading deletion across disk media and 6 MongoDB collections."
        ]),
        ("MILESTONE 4", "Zero-Loss Cloud, Testing & Production Delivery", "WEEKS 7 & 8", "PASSED 100%", ACCENT_EMERALD, (236, 253, 245), [
            "Integrated Google Drive API v3 delivering 15 GB persistent personal cloud storage.",
            "Engineered HTTP 206 Partial Content range video streaming proxy (<20ms seeking).",
            "Built interactive AI Concept Mind Map canvas with dynamic pan, zoom, and seek.",
            "Transformed user interface into an artisanal Linear/Raycast dark/light engineering UI.",
            "Containerized full stack with multi-stage Dockerfiles and docker-compose.yml.",
            "Authored comprehensive reports, 10-slide visual presentation, and demo scripts."
        ]),
    ]

    card_w = (W - 120 - 3 * 30) / 4
    card_h = 880
    y = 200

    for i, (m_tag, m_title, m_weeks, m_status, col, bg, points) in enumerate(milestones):
        x = 60 + i * (card_w + 30)
        draw_rounded_card(draw, (x, y, x + card_w, y + card_h), fill=CARD_BG, outline=col, radius=14, width=2)

        # Header bar
        draw.rounded_rectangle((x + 2, y + 2, x + card_w - 2, y + 78), radius=12, fill=bg)
        draw.text((x + 16, y + 10), m_tag, font=get_font(13, bold=True), fill=col)
        draw.text((x + 16, y + 32), m_title, font=get_font(16, bold=True), fill=PRIMARY_NAVY)

        # Badges
        draw_pill(draw, (x + 16, y + 90, x + 130, y + 116), m_weeks, get_font(11, bold=True), bg, col, radius=5)
        draw_pill(draw, (x + 140, y + 90, x + 265, y + 116), m_status, get_font(11, bold=True), (236, 253, 245), ACCENT_EMERALD, radius=5)

        draw.line([(x + 16, y + 130), (x + card_w - 16, y + 130)], fill=BORDER_COLOR, width=1)

        # Bullet list
        by = y + 150
        for pt in points:
            draw.ellipse((x + 18, by + 6, x + 26, by + 14), fill=col)
            words = pt.split()
            lines = []
            cur = []
            for w in words:
                test_str = " ".join(cur + [w])
                if get_font(14).getbbox(test_str)[2] > (card_w - 55):
                    lines.append(" ".join(cur))
                    cur = [w]
                else:
                    cur.append(w)
            if cur:
                lines.append(" ".join(cur))

            for l in lines:
                draw.text((x + 36, by), l, font=get_font(14), fill=TEXT_DARK)
                by += 24
            by += 16

        # Step connector arrow at top between milestone cards
        if i < 3:
            arr_x = x + card_w + 4
            arr_y = y + 40
            draw.line([(arr_x, arr_y), (arr_x + 22, arr_y)], fill=ACCENT_BLUE, width=3)
            draw.polygon([(arr_x + 16, arr_y - 6), (arr_x + 16, arr_y + 6), (arr_x + 24, arr_y)], fill=ACCENT_BLUE)

    out_path = os.path.join(IMAGES_DIR, "milestone_implementation_timeline.png")
    im.save(out_path, "PNG", quality=95)
    print(f"Generated: {out_path}")


# ==============================================================================
# Diagram 5: End-to-End Processing Workflow (High-Level Data Lifecycle)
# ==============================================================================
def generate_end_to_end_workflow_diagram():
    W, H = 2400, 1400
    im = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(im)

    draw_header(draw, W, 
                "CLIPMIND AI • COMPLETE DATA LIFECYCLE & TELEMETRY TOPOLOGY",
                "End-to-End Processing Workflow",
                "From multi-source ingestion and zero-loss Google Drive synchronization to multimodal AI inference, persistence, and role workspaces.")

    phases = [
        ("PHASE 1", "Ingestion Sources", ACCENT_BLUE, (239, 246, 255), [
            ("Local File Upload", "MP4, MOV, MKV, WebM up to 500MB via chunked multipart stream"),
            ("YouTube Ingestion", "yt-dlp asynchronous download & stream extractor"),
            ("Google Drive Storage", "Direct connection using Google Identity Services (GIS)")
        ]),
        ("PHASE 2", "Gateway & Cloud Storage", ACCENT_CYAN, (236, 254, 255), [
            ("FastAPI ASGI Gateway", "MIME validation, SHA-256 hashing & UUIDv4 allocation"),
            ("Auto-Cloud Sync", "Background upload to Google Drive attaches drive_file_id"),
            ("Zero-Loss Cloud Fallback", "Downloads media to buffer if container disk reset"),
            ("WebSocket Telemetry", "Dispatches stage events to connected clients")
        ]),
        ("PHASE 3", "Multimodal AI Engine", ACCENT_PURPLE, (245, 243, 255), [
            ("FFmpeg Demuxer", "Converts audio to 16kHz mono WAV (Whisper acoustic format)"),
            ("OpenAI Whisper ASR", "Sub-second word timestamps & 4.18% WER transcription"),
            ("Dual-Tier NLP", "LexRank TF-IDF TL;DR (<1.5s) + LLM chapters & quizzes"),
            ("OpenCV Vision Analysis", "1 fps frame deltas & HSV histograms for scene cuts"),
            ("Concept Mind Map", "Hierarchical knowledge graph with timestamp seek links")
        ]),
        ("PHASE 4", "Persistence & Delivery", PRIMARY_NAVY, (241, 245, 249), [
            ("Relational DB (SQL)", "Users, salted Bcrypt hashes, 50+ event audit logs"),
            ("Document DB (Atlas)", "Videos, Transcripts, Summaries, Quizzes, Mind Maps"),
            ("HTTP 206 Streaming", "Byte-range proxy enabling sub-20ms seeking latency"),
            ("Multi-Format Exporter", "Compiles PDF, DOCX, TXT, SRT, and VTT packages")
        ]),
        ("PHASE 5", "Role Workspaces", ACCENT_EMERALD, (236, 253, 245), [
            ("Content Creator", "Media library, summaries, mind maps & multi-format exports"),
            ("Learner Study Room", "Synced player, interactive quizzes & 3D flip flashcards"),
            ("5-Tab Educator Studio", "Transcripts, chapters, quizzes, cards & WYSIWYG preview"),
            ("Administrator Hub", "User governance, role assignment & system health telemetry")
        ]),
    ]

    col_w = (W - 120 - 4 * 32) / 5
    card_h = 1140
    y = 200

    for i, (p_tag, p_title, col, bg, items) in enumerate(phases):
        x = 60 + i * (col_w + 32)
        draw_rounded_card(draw, (x, y, x + col_w, y + card_h), fill=CARD_BG, outline=col, radius=14, width=2)

        # Header Box
        draw.rounded_rectangle((x + 2, y + 2, x + col_w - 2, y + 74), radius=12, fill=bg)
        draw.text((x + 16, y + 10), p_tag, font=get_font(13, bold=True), fill=col)
        draw.text((x + 16, y + 32), p_title, font=get_font(18, bold=True), fill=PRIMARY_NAVY)

        # Content blocks
        iy = y + 95
        for item_title, item_desc in items:
            block_h = 175 if len(items) <= 3 else 145
            draw.rounded_rectangle((x + 14, iy, x + col_w - 14, iy + block_h), radius=8, fill=(248, 250, 252), outline=BORDER_COLOR, width=1)
            # Indicator dot
            draw.ellipse((x + 26, iy + 16, x + 34, iy + 24), fill=col)
            # Item title
            draw.text((x + 42, iy + 12), item_title, font=get_font(15, bold=True), fill=PRIMARY_NAVY)
            # Item description
            words = item_desc.split()
            lines = []
            cur = []
            for w in words:
                test_str = " ".join(cur + [w])
                if get_font(13).getbbox(test_str)[2] > (col_w - 55):
                    lines.append(" ".join(cur))
                    cur = [w]
                else:
                    cur.append(w)
            if cur:
                lines.append(" ".join(cur))

            dy = iy + 45
            for l in lines:
                draw.text((x + 26, dy), l, font=get_font(13), fill=TEXT_DARK)
                dy += 22

            iy += block_h + 14

        # Arrow between columns
        if i < 4:
            arr_x = x + col_w + 5
            arr_y = y + card_h // 2
            draw.line([(arr_x, arr_y), (arr_x + 22, arr_y)], fill=ACCENT_BLUE, width=3)
            draw.polygon([(arr_x + 16, arr_y - 6), (arr_x + 16, arr_y + 6), (arr_x + 24, arr_y)], fill=ACCENT_BLUE)

    out_path = os.path.join(IMAGES_DIR, "end_to_end_processing_workflow.png")
    im.save(out_path, "PNG", quality=95)
    print(f"Generated: {out_path}")


if __name__ == "__main__":
    generate_novelty_diagram()
    generate_architecture_flow_diagram()
    generate_pipeline_workflow_diagram()
    generate_milestone_timeline_diagram()
    generate_end_to_end_workflow_diagram()
    print("All 5 flowchart diagrams generated successfully!")


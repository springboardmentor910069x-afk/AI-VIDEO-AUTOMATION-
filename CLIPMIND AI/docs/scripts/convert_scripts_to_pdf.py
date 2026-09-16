import os
import re
import html
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

SCRIPTS_DIR = r"d:/SPRING BOARD/AI-VIDEO-AUTOMATION-/CLIPMIND AI/docs/scripts"

class ScriptNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(ScriptNumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super(ScriptNumberedCanvas, self).showPage()
        super(ScriptNumberedCanvas, self).save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 756, "ClipMind AI • Official Presentation & Demonstration Narration Script")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 750, 576, 750)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 25, footer_text)
        self.drawString(36, 25, "Infosys Springboard AI & Full-Stack Cloud Internship • Adabala Venkata Thrinadh")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 35, 576, 35)
        
        self.restoreState()

def md_inline_to_reportlab(text):
    text = html.escape(text)
    # Handle bold-italic ***text*** first
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<b><i>\1</i></b>', text)
    # Handle bold **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # Handle italic *text* (avoiding match across multiple lines or tags)
    text = re.sub(r'(?<!\*)\*([^\*\n<]+?)\*(?!\*)', r'<i>\1</i>', text)
    # Inline code
    text = re.sub(r'`(.*?)`', r'<font name="Courier" color="#B91C1C">\1</font>', text)
    text = text.replace(r'\|', '|').replace(r'\_', '_')
    return text

def parse_script_markdown(md_content):
    lines = md_content.splitlines()
    blocks = []
    i = 0
    n = len(lines)
    
    while i < n:
        line = lines[i]
        stripped = line.strip()
        
        if not stripped:
            i += 1
            continue
            
        # Code block
        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            code_lines = []
            i += 1
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < n:
                i += 1
            blocks.append({
                "type": "code",
                "lang": lang,
                "content": "\n".join(code_lines)
            })
            continue

        # Table
        if stripped.startswith("|") and stripped.endswith("|"):
            table_lines = []
            while i < n and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            rows = []
            for t_line in table_lines:
                cells = [c.strip() for c in t_line.split("|")[1:-1]]
                if all(re.match(r'^:?-+:?$', c) for c in cells if c):
                    continue
                rows.append(cells)
            if rows:
                blocks.append({
                    "type": "table",
                    "rows": rows
                })
            continue
            
        # Blockquote / Narration quote
        if stripped.startswith(">"):
            quote_lines = []
            while i < n and (lines[i].strip().startswith(">") or (lines[i].strip() and quote_lines)):
                l_str = lines[i].strip()
                if l_str.startswith(">"):
                    content = l_str[1:].strip()
                    if content.startswith('"') or content.startswith('*'):
                        pass
                    quote_lines.append(content)
                elif l_str and not l_str.startswith("#"):
                    quote_lines.append(l_str)
                else:
                    break
                i += 1
            blocks.append({
                "type": "quote",
                "text": " ".join(quote_lines)
            })
            continue
            
        # Horizontal Rule
        if re.match(r'^-{3,}$', stripped) or re.match(r'^\*{3,}$', stripped):
            blocks.append({"type": "hr"})
            i += 1
            continue
            
        # Headings
        m_head = re.match(r'^(#{1,6})\s+(.*)$', stripped)
        if m_head:
            level = len(m_head.group(1))
            text = m_head.group(2).strip()
            blocks.append({
                "type": "heading",
                "level": level,
                "text": text
            })
            i += 1
            continue
            
        # Bullet list item
        m_bullet = re.match(r'^[-*]\s+(.*)$', stripped)
        if m_bullet:
            blocks.append({
                "type": "bullet",
                "text": m_bullet.group(1).strip()
            })
            i += 1
            continue
            
        # Numbered list item
        m_num = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if m_num:
            blocks.append({
                "type": "numbered",
                "num": m_num.group(1),
                "text": m_num.group(2).strip()
            })
            i += 1
            continue
            
        # Normal paragraph
        para_lines = [line]
        i += 1
        while i < n:
            next_line = lines[i]
            next_strip = next_line.strip()
            if (not next_strip or 
                next_strip.startswith("```") or 
                (next_strip.startswith("|") and next_strip.endswith("|")) or
                next_strip.startswith(">") or
                re.match(r'^-{3,}$', next_strip) or
                re.match(r'^(#{1,6})\s+', next_strip) or
                re.match(r'^[-*]\s+', next_strip) or
                re.match(r'^\d+\.\s+', next_strip)):
                break
            para_lines.append(next_line)
            i += 1
        blocks.append({
            "type": "paragraph",
            "text": " ".join(l.strip() for l in para_lines)
        })
        
    return blocks

def generate_script_pdf(blocks, output_path, title_header="ClipMind AI Script"):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=54,
        bottomMargin=54
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'ScriptTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'ScriptH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=16,
        textColor=colors.HexColor('#0284C7'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    h3_style = ParagraphStyle(
        'ScriptH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )
    h4_style = ParagraphStyle(
        'ScriptH4',
        parent=styles['Heading4'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#475569'),
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'ScriptBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12.5,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=4
    )
    bullet_style = ParagraphStyle(
        'ScriptBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=2
    )
    quote_style = ParagraphStyle(
        'ScriptQuote',
        parent=body_style,
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=3,
        spaceAfter=3
    )
    code_style = ParagraphStyle(
        'ScriptCode',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=2,
        spaceAfter=2
    )
    table_header_style = ParagraphStyle(
        'ScriptTableHead',
        parent=body_style,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )
    table_body_style = ParagraphStyle(
        'ScriptTableBody',
        parent=body_style,
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1E293B')
    )

    story = []

    for block in blocks:
        b_type = block["type"]
        
        if b_type == "heading":
            level = block["level"]
            text = block["text"].replace("**", "").replace("`", "")
            if level == 1:
                story.append(Paragraph(text, title_style))
            elif level == 2:
                story.append(Paragraph(text, h2_style))
            elif level == 3:
                story.append(Paragraph(text, h3_style))
            else:
                story.append(Paragraph(text, h4_style))
                
        elif b_type == "paragraph":
            story.append(Paragraph(md_inline_to_reportlab(block["text"]), body_style))

        elif b_type == "table":
            rows = block["rows"]
            if not rows:
                continue
            table_data = []
            num_cols = max(len(r) for r in rows)
            for r_idx, row in enumerate(rows):
                row_paras = []
                for c_idx in range(num_cols):
                    cell_text = row[c_idx] if c_idx < len(row) else ""
                    if r_idx == 0:
                        p = Paragraph(f"<b>{md_inline_to_reportlab(cell_text)}</b>", table_header_style)
                    else:
                        p = Paragraph(md_inline_to_reportlab(cell_text), table_body_style)
                    row_paras.append(p)
                table_data.append(row_paras)

            # Proportional widths
            total_width = 540
            if num_cols == 5:
                col_widths = [75, 110, 85, 200, 70]
            else:
                col_widths = [total_width / num_cols] * num_cols

            t = Table(table_data, colWidths=col_widths)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8FAFC')]),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(Spacer(1, 3))
            story.append(t)
            story.append(Spacer(1, 5))
            
        elif b_type == "quote":
            # Render spoken narration in a styled callout box table
            clean_q = block["text"].strip()
            # Strip enclosing quotes or asterisks if any
            for _ in range(2):
                clean_q = clean_q.strip()
                if clean_q.startswith('"') and clean_q.endswith('"'):
                    clean_q = clean_q[1:-1].strip()
                elif clean_q.startswith('*') and clean_q.endswith('*'):
                    clean_q = clean_q[1:-1].strip()
                elif clean_q.startswith('“') and clean_q.endswith('”'):
                    clean_q = clean_q[1:-1].strip()

            p_q = Paragraph(f"<b>Verbal Narration:</b><br/>\"{md_inline_to_reportlab(clean_q)}\"", quote_style)
            tbl = Table([[p_q]], colWidths=[540])
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('LINELEFT', (0, 0), (0, -1), 3.0, colors.HexColor('#0284C7')),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(Spacer(1, 2))
            story.append(tbl)
            story.append(Spacer(1, 4))
            
        elif b_type == "bullet":
            bullet_text = f"&bull;&nbsp; {md_inline_to_reportlab(block['text'])}"
            story.append(Paragraph(bullet_text, bullet_style))
            
        elif b_type == "numbered":
            num_text = f"<b>{block['num']}.</b>&nbsp; {md_inline_to_reportlab(block['text'])}"
            story.append(Paragraph(num_text, bullet_style))
            
        elif b_type == "hr":
            story.append(Spacer(1, 3))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceAfter=6, spaceBefore=3))
            
        elif b_type == "code":
            clean_code = html.escape(block["content"])
            code_para = Paragraph(f"<pre>{clean_code}</pre>", code_style)
            c_tbl = Table([[code_para]], colWidths=[540])
            c_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(Spacer(1, 2))
            story.append(c_tbl)
            story.append(Spacer(1, 4))

    doc.build(story, canvasmaker=ScriptNumberedCanvas)
    print(f"Generated PDF: {output_path}")

def convert_all_scripts():
    scripts = [
        ("PPT_EXPLANATION_SCRIPT.md", "PPT_EXPLANATION_SCRIPT.pdf", "ClipMind AI — 10-Slide Narration Script"),
        ("PROJECT_DEMO_EXPLANATION_SCRIPT.md", "PROJECT_DEMO_EXPLANATION_SCRIPT.pdf", "ClipMind AI — Live Demonstration Script"),
        ("PROJECT_FILE_EXPLANATION_SCRIPT.md", "PROJECT_FILE_EXPLANATION_SCRIPT.pdf", "ClipMind AI — Codebase & Architecture File Guide"),
        ("7_PEOPLE_PRESENTATION_PLAN.md", "7_PEOPLE_PRESENTATION_PLAN.pdf", "ClipMind AI — 7-Person Team Presentation Plan"),
    ]

    for md_name, pdf_name, title in scripts:
        md_path = os.path.join(SCRIPTS_DIR, md_name)
        pdf_path = os.path.join(SCRIPTS_DIR, pdf_name)
        if os.path.exists(md_path):
            with open(md_path, "r", encoding="utf-8") as f:
                content = f.read()
            blocks = parse_script_markdown(content)
            generate_script_pdf(blocks, pdf_path, title_header=title)

    # Master Consolidated Script PDF
    master_pdf = os.path.join(SCRIPTS_DIR, "CLIPMIND_AI_MASTER_EXPLANATION_SCRIPTS.pdf")
    combined_blocks = []
    for md_name, _, _ in scripts:
        md_path = os.path.join(SCRIPTS_DIR, md_name)
        if os.path.exists(md_path):
            with open(md_path, "r", encoding="utf-8") as f:
                content = f.read()
            combined_blocks.extend(parse_script_markdown(content))
            combined_blocks.append({"type": "hr"})

    generate_script_pdf(combined_blocks, master_pdf, title_header="ClipMind AI Complete Explanation & Demonstration Scripts")
    print("All script PDFs generated successfully!")

if __name__ == "__main__":
    convert_all_scripts()

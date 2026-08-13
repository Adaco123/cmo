"""Generación de reportes PDF para el historial clínico."""
import os
from datetime import date
from io import BytesIO

from flask import Blueprint, jsonify, send_file
from flask_jwt_extended import jwt_required
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    FrameBreak,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.historial_clinico.models import RegistroClinico

historial_clinico_reportes_bp = Blueprint("historial_clinico_reportes", __name__)

# ---------------------------------------------------------------------------
# Datos del consultorio (ajustar con la información real)
# ---------------------------------------------------------------------------
CONSULTORIO_NOMBRE_L1 = "CONSULTORIO"
CONSULTORIO_NOMBRE_L2 = "DE ECOGRAFÍA"
CONSULTORIO_DIRECCION = ""   # ej. "Av. 6 de Agosto #123, La Paz"
CONSULTORIO_TELEFONO = ""    # ej. "+591 700 00000"
CONSULTORIO_REGISTRO = ""    # ej. "Reg. Sanitario N.º 0000"

# ---------------------------------------------------------------------------
# Paleta de colores — identidad azul oscuro / dorado
# ---------------------------------------------------------------------------
# Azul oscuro: color primario institucional (dominante)
# Dorado: color secundario de acento (aporta calidez y distinción)
# Teal: acento sutil para detalles y áreas secundarias
PRIMARY_HEX = "#0B2A4A"         # Azul navy profundo
PRIMARY_DARK_HEX = "#061A2E"    # Azul casi negro
SECONDARY_HEX = "#C59B46"       # Dorado cálido
SECONDARY_DARK_HEX = "#A37D32"  # Dorado más oscuro
ACCENT_HEX = "#2B7A9E"          # Azul teal (para botones, badges, líneas)

PRIMARY = colors.HexColor(PRIMARY_HEX)
PRIMARY_DARK = colors.HexColor(PRIMARY_DARK_HEX)
SECONDARY = colors.HexColor(SECONDARY_HEX)
SECONDARY_DARK = colors.HexColor(SECONDARY_DARK_HEX)
ACCENT = colors.HexColor(ACCENT_HEX)

BACKGROUND = colors.HexColor("#0A1F36")   # Base del degradado lateral (muy oscuro)
SURFACE = colors.HexColor("#1A3B5C")      # Punto central del degradado (azul medio)
WHITE = colors.HexColor("#F8F9FA")        # Blanco roto (más suave para la vista)
SILVER = colors.HexColor("#B0C4D9")       # Gris azulado para líneas y bordes
GRAY = colors.HexColor("#6B7F96")         # Gris para textos secundarios

CARD_BG = colors.HexColor("#FFFFFF")
CARD_BORDER = colors.HexColor("#DDE4EC")
ALERT_BG = colors.HexColor("#FBF3F0")     # Fondo muy suave terracota para alertas
ALERT_BORDER = colors.HexColor("#E4C1B5")
TILE_BORDER = colors.HexColor("#E2E8F0")

PAGE_W, PAGE_H = letter
MARGIN = 12 * mm
FOOTER_H = 9 * mm
TOPBAND_H = 2.6 * mm  # franja de marca (azul → dorado) en el borde superior

SIDEBAR_W = 60 * mm
SIDE_PAD = 8 * mm
MAIN_X = SIDEBAR_W + 7 * mm
MAIN_W = PAGE_W - MAIN_X - MARGIN
MAIN_TOP_GAP = 12 * mm

IMAGE_PATH = os.path.join(os.path.dirname(__file__), "cmo.png")

_LOGO_CACHE = {}


def _get_logo():
    if "logo" not in _LOGO_CACHE:
        _LOGO_CACHE["logo"] = ImageReader(IMAGE_PATH) if os.path.exists(IMAGE_PATH) else None
    return _LOGO_CACHE["logo"]


def _format_value(value):
    if value is None or value == "":
        return "—"
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


def _calcular_edad(fecha_nacimiento):
    """Calcula la edad a partir de la fecha de nacimiento guardada en la BD."""
    if not fecha_nacimiento or not hasattr(fecha_nacimiento, "year"):
        return "—"
    hoy = date.today()
    if fecha_nacimiento > hoy:
        # Fecha de nacimiento inválida (posterior a hoy); evita mostrar edad negativa.
        return "—"
    edad = hoy.year - fecha_nacimiento.year - (
        (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )
    return f"{edad} años"


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("SideWordmark", fontName="Helvetica-Bold", fontSize=13,
                               textColor=WHITE, leading=16, alignment=1))
    styles.add(ParagraphStyle("SideLabel", fontName="Helvetica-Bold", fontSize=6.6,
                               textColor=ACCENT, leading=9, spaceAfter=1))
    styles.add(ParagraphStyle("SideValue", fontName="Helvetica", fontSize=9,
                               textColor=WHITE, leading=12))
    styles.add(ParagraphStyle("SideName", fontName="Helvetica-Bold", fontSize=13,
                               textColor=WHITE, leading=16))
    styles.add(ParagraphStyle("SideBadge", fontName="Helvetica-Bold", fontSize=9,
                               textColor=WHITE, leading=11, alignment=1))
    styles.add(ParagraphStyle("SideFoot", fontName="Helvetica", fontSize=6.6,
                               textColor=colors.HexColor("#7C8CA0"), leading=9))
    styles.add(ParagraphStyle("SectionTitleFlat", fontName="Helvetica-Bold", fontSize=10,
                               textColor=PRIMARY, leading=12))
    styles.add(ParagraphStyle("TileLabel", fontName="Helvetica-Bold", fontSize=6.6,
                               textColor=GRAY, leading=8.5))
    styles.add(ParagraphStyle("TileValue", fontName="Helvetica-Bold", fontSize=11.5,
                               textColor=PRIMARY_DARK, leading=14))
    styles.add(ParagraphStyle("Label", fontName="Helvetica-Bold", fontSize=6.8,
                               textColor=GRAY, leading=9, spaceAfter=1))
    styles.add(ParagraphStyle("Value", fontName="Helvetica", fontSize=8.6,
                               textColor=colors.HexColor("#132339"), leading=11.5))
    styles.add(ParagraphStyle("ValueAlert", parent=styles["Value"], textColor=SECONDARY_DARK,
                               fontName="Helvetica-Bold"))
    return styles


# ---------------------------------------------------------------------------
# Fondo estático de cada página: franja de marca, barra lateral, degradado,
# logo y marca de agua
# ---------------------------------------------------------------------------
def _draw_topband(canvas):
    """Franja superior de marca: degradado horizontal azul -> dorado que recorre
    todo el ancho de la página. Es la firma visual del reporte."""
    canvas.saveState()
    try:
        canvas.linearGradient(
            0, PAGE_H - TOPBAND_H, PAGE_W, PAGE_H,
            (PRIMARY, ACCENT, SECONDARY),
            positions=(0, 0.55, 1),
            extend=True,
        )
    except Exception:
        canvas.setFillColor(PRIMARY)
        canvas.rect(0, PAGE_H - TOPBAND_H, PAGE_W, TOPBAND_H, stroke=0, fill=1)
    canvas.restoreState()


def _draw_watermark(canvas):
    """Marca de agua limitada al área principal."""
    logo = _get_logo()
    if logo is None:
        return
    img_w, img_h = logo.getSize()
    target_w = 90 * mm
    ratio = target_w / img_w
    w, h = img_w * ratio, img_h * ratio
    cx = MAIN_X + MAIN_W / 2
    cy = PAGE_H / 2
    canvas.saveState()
    p = canvas.beginPath()
    p.rect(MAIN_X, 0, MAIN_W, PAGE_H)
    canvas.clipPath(p, stroke=0, fill=0)
    canvas.setFillAlpha(0.05)
    canvas.setStrokeAlpha(0.05)
    canvas.drawImage(logo, cx - w / 2, cy - h / 2, width=w, height=h, mask="auto", preserveAspectRatio=True)
    canvas.restoreState()


def _draw_sidebar_bg(canvas):
    """Barra lateral con degradado vertical suave y círculos decorativos."""
    canvas.saveState()
    try:
        canvas.linearGradient(
            0, 0, 0, PAGE_H,
            (BACKGROUND, SURFACE, BACKGROUND),
            positions=(0, 0.55, 1),
            extend=True,
        )
        p = canvas.beginPath()
        p.rect(0, 0, SIDEBAR_W, PAGE_H)
        canvas.clipPath(p, stroke=0, fill=0)
        canvas.linearGradient(0, 0, 0, PAGE_H, (BACKGROUND, SURFACE, BACKGROUND), positions=(0, 0.55, 1))
    except Exception:
        canvas.setFillColor(BACKGROUND)
        canvas.rect(0, 0, SIDEBAR_W, PAGE_H, stroke=0, fill=1)
    canvas.restoreState()

    # Círculos decorativos translúcidos para dar profundidad (azul + dorado)
    canvas.saveState()
    p = canvas.beginPath()
    p.rect(0, 0, SIDEBAR_W, PAGE_H)
    canvas.clipPath(p, stroke=0, fill=0)
    canvas.setFillColor(ACCENT)
    canvas.setFillAlpha(0.08)
    canvas.circle(SIDEBAR_W + 6 * mm, PAGE_H - 30 * mm, 42 * mm, stroke=0, fill=1)
    canvas.setFillColor(PRIMARY)
    canvas.setFillAlpha(0.12)
    canvas.circle(-10 * mm, 40 * mm, 46 * mm, stroke=0, fill=1)
    canvas.setFillColor(SECONDARY)
    canvas.setFillAlpha(0.10)
    canvas.circle(SIDEBAR_W - 4 * mm, 8 * mm, 22 * mm, stroke=0, fill=1)
    canvas.restoreState()

    # Borde derecho de la barra lateral: azul (superior) y dorado (inferior)
    split = PAGE_H * 0.6
    canvas.setFillColor(ACCENT)
    canvas.rect(SIDEBAR_W - 1.1, split, 1.1, PAGE_H - split, stroke=0, fill=1)
    canvas.setFillColor(SECONDARY)
    canvas.rect(SIDEBAR_W - 1.1, 0, 1.1, split, stroke=0, fill=1)


def _draw_page_furniture(canvas, doc, registro):
    canvas.saveState()
    _draw_topband(canvas)
    _draw_watermark(canvas)
    _draw_sidebar_bg(canvas)

    # Logo dentro de un anillo circular (con borde dorado)
    logo = _get_logo()
    cx = SIDEBAR_W / 2
    ring_r = 12 * mm
    ring_cy = PAGE_H - 18 * mm
    canvas.setStrokeColor(SECONDARY)        # Dorado para el anillo
    canvas.setLineWidth(1.1)
    canvas.circle(cx, ring_cy, ring_r, stroke=1, fill=0)
    if logo is not None:
        img_w, img_h = logo.getSize()
        d = (ring_r - 2.4 * mm) * 2
        ratio = min(d / img_w, d / img_h)
        w, h = img_w * ratio, img_h * ratio
        canvas.drawImage(logo, cx - w / 2, ring_cy - h / 2, width=w, height=h, mask="auto", preserveAspectRatio=True)

    # Pie de página (área principal): datos del registro + del consultorio
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica", 6.6)
    footer_left = f"Registro N.º {registro.id}"
    if CONSULTORIO_TELEFONO or CONSULTORIO_REGISTRO:
        extra = " · ".join(filter(None, [CONSULTORIO_TELEFONO, CONSULTORIO_REGISTRO]))
        footer_left = f"{footer_left}   |   {extra}"
    canvas.drawString(MAIN_X, 6.5 * mm, footer_left)
    canvas.drawRightString(PAGE_W - MARGIN, 6.5 * mm, f"Página {doc.page}")
    canvas.setStrokeColor(PRIMARY)
    canvas.setLineWidth(0.9)
    canvas.line(MAIN_X, 9 * mm, MAIN_X + MAIN_W * 0.65, 9 * mm)
    canvas.setStrokeColor(SECONDARY)
    canvas.line(MAIN_X + MAIN_W * 0.65, 9 * mm, PAGE_W - MARGIN, 9 * mm)

    canvas.restoreState()


# ---------------------------------------------------------------------------
# Bloques reutilizables
# ---------------------------------------------------------------------------
def _empty_tile():
    """Celda vacía usada para rellenar la grilla de signos vitales."""
    wrap = Table([[""]], colWidths=[None], rowHeights=[1])
    wrap.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return wrap


def _stat_tile(label, value, styles):
    inner = Table(
        [[Paragraph(label.upper(), styles["TileLabel"])], [Paragraph(str(value), styles["TileValue"])]],
        colWidths=[None],
    )
    inner.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (0, 0), 8),
        ("TOPPADDING", (0, 1), (0, 1), 2),
        ("BOTTOMPADDING", (0, -1), (0, -1), 8),
    ]))
    wrap = Table([[""], [inner]], colWidths=[None])
    wrap.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), PRIMARY),
        ("BACKGROUND", (0, 1), (0, 1), WHITE),
        ("TOPPADDING", (0, 0), (0, 0), 1.3),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOX", (0, 0), (-1, -1), 0.8, TILE_BORDER),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return wrap


def _stat_grid(rows, styles, ncols=3, gutter=5):
    tiles = [_stat_tile(label, value, styles) for label, value in rows]
    grid_rows = []
    for i in range(0, len(tiles), ncols):
        chunk = tiles[i:i + ncols]
        while len(chunk) < ncols:
            chunk.append(_empty_tile())
        grid_rows.append(chunk)
    col_w = (MAIN_W - gutter * (ncols - 1)) / ncols
    table = Table(grid_rows, colWidths=[col_w] * ncols)
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), gutter),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), gutter),
    ]))
    return table


def _kv_grid(rows, styles, ncols, avail_width):
    cells = []
    for label, value, alert in rows:
        value_style = styles["ValueAlert"] if alert else styles["Value"]
        cell = Table(
            [[Paragraph(label.upper(), styles["Label"])], [Paragraph(str(value), value_style)]],
            colWidths=[None],
        )
        cells.append(cell)
    grid_rows = []
    for i in range(0, len(cells), ncols):
        chunk = cells[i:i + ncols]
        row = list(chunk)
        while len(row) < ncols:
            row.append("")
        grid_rows.append(row)
    col_w = avail_width / ncols
    table = Table(grid_rows, colWidths=[col_w] * ncols)
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.6, SILVER),
    ]))
    return table


def _section(title, rows, styles, ncols=2, accent=PRIMARY, accent_hex=PRIMARY_HEX, alert=False):
    bar_w = 3.2
    pad_l, pad_r, pad_t, pad_b = 10, 9, 6, 4
    inner_w = MAIN_W - bar_w - pad_l - pad_r

    title_para = Paragraph(f'<font color="{accent_hex}">{title}</font>', styles["SectionTitleFlat"])
    title_wrap = Table([[title_para]], colWidths=[inner_w])
    title_wrap.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.9, accent),
    ]))

    inner = Table([[title_wrap], [_kv_grid(rows, styles, ncols, inner_w)]], colWidths=[inner_w])
    inner.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    outer = Table([["", inner]], colWidths=[bar_w, MAIN_W - bar_w])
    outer.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), SECONDARY if alert else accent),
        ("BACKGROUND", (1, 0), (1, -1), ALERT_BG if alert else CARD_BG),
        ("BOX", (0, 0), (-1, -1), 0.8, ALERT_BORDER if alert else CARD_BORDER),
        ("ROUNDEDCORNERS", [7, 7, 7, 7]),
        ("LEFTPADDING", (0, 0), (0, -1), 0), ("RIGHTPADDING", (0, 0), (0, -1), 0),
        ("LEFTPADDING", (1, 0), (1, -1), pad_l), ("RIGHTPADDING", (1, 0), (1, -1), pad_r),
        ("TOPPADDING", (0, 0), (-1, -1), pad_t), ("BOTTOMPADDING", (0, 0), (-1, -1), pad_b),
    ]))
    return outer


def _side_kv(label, value, styles):
    t = Table([[Paragraph(label.upper(), styles["SideLabel"])], [Paragraph(str(value), styles["SideValue"])]],
               colWidths=[None])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def _build_registro_pdf(registro: RegistroClinico) -> bytes:
    buffer = BytesIO()
    styles = _styles()

    paciente = registro.paciente
    medico = registro.medico

    doc = BaseDocTemplate(buffer, pagesize=letter, leftMargin=0, rightMargin=0, topMargin=0, bottomMargin=0)

    sidebar_frame = Frame(
        0, 0, SIDEBAR_W, PAGE_H, id="sidebar",
        leftPadding=SIDE_PAD, rightPadding=SIDE_PAD,
        topPadding=34 * mm, bottomPadding=10 * mm,
    )
    main_frame = Frame(
        MAIN_X, FOOTER_H + 3 * mm, MAIN_W, PAGE_H - MAIN_TOP_GAP - FOOTER_H - 3 * mm, id="main",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates([
        PageTemplate(id="registro", frames=[sidebar_frame, main_frame],
                     onPage=lambda c, d: _draw_page_furniture(c, d, registro))
    ])

    story = []

    # ---------------- Barra lateral ----------------
    story.append(Paragraph(CONSULTORIO_NOMBRE_L1, styles["SideWordmark"]))
    story.append(Paragraph(CONSULTORIO_NOMBRE_L2, styles["SideWordmark"]))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=10))

    story.append(Paragraph("PACIENTE", styles["SideLabel"]))
    nombre = f"{paciente.nombres} {paciente.apellidos}" if paciente else "Paciente no registrado"
    story.append(Paragraph(nombre, styles["SideName"]))
    story.append(Spacer(1, 9))

    story.append(_side_kv("Documento", _format_value(paciente.documento) if paciente else "—", styles))
    story.append(Spacer(1, 6))
    story.append(_side_kv("Edad · Sexo", f"{_calcular_edad(paciente.fecha_nacimiento) if paciente else '—'} · {_format_value(paciente.sexo) if paciente else '—'}", styles))
    story.append(Spacer(1, 6))
    story.append(_side_kv("Teléfono", _format_value(paciente.telefono) if paciente else "—", styles))
    story.append(Spacer(1, 6))
    story.append(_side_kv("Dirección", _format_value(paciente.direccion) if paciente else "—", styles))
    story.append(Spacer(1, 6))
    #story.append(_side_kv("Médico responsable", f"{medico.nombres} {medico.apellidos}" if medico else "—", styles))

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#25405E"), spaceAfter=10))

    badge = Table([[Paragraph(f"{_format_value(registro.fecha)}", styles["SideBadge"])],
                    [Paragraph(f"{_format_value(registro.hora)} hrs", styles["SideBadge"])]], colWidths=[None])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("LINEBELOW", (0, 0), (0, 0), 1.4, SECONDARY),  # Línea dorada
        ("TOPPADDING", (0, 0), (0, 0), 7), ("BOTTOMPADDING", (0, 0), (0, 0), 4),
        ("TOPPADDING", (0, 1), (0, 1), 4), ("BOTTOMPADDING", (0, 1), (0, 1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Paragraph("FECHA DE ATENCIÓN", styles["SideLabel"]))
    story.append(Spacer(1, 4))
    story.append(badge)

    # Pie de la barra lateral: datos de contacto del consultorio, si están configurados
    footer_lines = [l for l in (CONSULTORIO_DIRECCION, CONSULTORIO_TELEFONO, CONSULTORIO_REGISTRO) if l]
    if footer_lines:
        story.append(Spacer(1, 14))
        for line in footer_lines:
            story.append(Paragraph(line, styles["SideFoot"]))
            story.append(Spacer(1, 2))

    story.append(FrameBreak())

    # ---------------- Contenido principal ----------------
    signos_rows = [
        ("Presión arterial", _format_value(registro.presion_arterial)),
        ("Frecuencia cardiaca", _format_value(registro.frecuencia_cardiaca)),
        ("Frecuencia respiratoria", _format_value(registro.frecuencia_respiratoria)),
        ("Temperatura", _format_value(registro.temperatura)),
        ("Peso", _format_value(registro.peso)),
        ("Talla", _format_value(registro.talla)),
    ]
    story.append(Paragraph(f'<font color="{PRIMARY_HEX}">SIGNOS VITALES</font>', styles["SectionTitleFlat"]))
    story.append(Spacer(1, 6))
    story.append(_stat_grid(signos_rows, styles, ncols=3))
    story.append(Spacer(1, 8))

    consulta_rows = [
        ("Motivo de consulta", _format_value(registro.motivo_consulta), False),
        ("Enfermedad actual", _format_value(registro.enfermedad_actual), False),
        ("Examen físico", _format_value(registro.examen_fisico), False),
        ("Diagnóstico", _format_value(registro.diagnostico), False),
        ("Tratamiento", _format_value(registro.tratamiento), False),
    ]
    story.append(_section("EVALUACIÓN CLÍNICA", consulta_rows, styles, ncols=1,
                           accent=SECONDARY, accent_hex=SECONDARY_HEX))
    story.append(Spacer(1, 8))

    tiene_alergias = bool(registro.alergias) and str(registro.alergias).strip() not in ("", "—")
    control_rows = [
        ("Consulta de control", _format_value(registro.consulta_control), False),
        ("Alergias", _format_value(registro.alergias), tiene_alergias),
        ("Observaciones", _format_value(registro.observaciones), False),
    ]
    story.append(_section(
        "SEGUIMIENTO Y ALERTAS" if tiene_alergias else "SEGUIMIENTO",
        control_rows, styles, ncols=2,
        accent=PRIMARY, accent_hex=PRIMARY_HEX, alert=tiene_alergias,
    ))

    doc.build(story)
    return buffer.getvalue()


@historial_clinico_reportes_bp.get("/registro/<int:registro_id>")
@jwt_required()
def generar_reporte_registro(registro_id):
    registro = RegistroClinico.get_by_id(registro_id)
    if not registro:
        return jsonify({"error": "Registro clínico no encontrado"}), 404

    pdf_bytes = _build_registro_pdf(registro)
    buffer = BytesIO(pdf_bytes)
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=False,
        download_name=f"registro_{registro_id}.pdf",
    )
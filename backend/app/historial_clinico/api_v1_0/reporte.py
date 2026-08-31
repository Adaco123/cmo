"""Generación de reportes PDF para el historial clínico.

Diseño pensado para imprimirse a diario en el consultorio: sin fondos
de color sólido, sin degradados ni marca de agua — solo texto y líneas
finas, para minimizar el consumo de tinta/tóner. El único acento de
color es el navy institucional, usado nada más en texto y filetes.
"""
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
    HRFlowable,
    Image,
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
CONSULTORIO_NOMBRE_L1 = "CONSULTORES"
CONSULTORIO_NOMBRE_L2 = "MEDICOS ORURO"
CONSULTORIO_DIRECCION = ""   # ej. "Av. 6 de Agosto #123, La Paz"
CONSULTORIO_TELEFONO = ""    # ej. "+591 700 00000"
CONSULTORIO_REGISTRO = ""    # ej. "Reg. Sanitario N.º 0000"

# ---------------------------------------------------------------------------
# Paleta — reducida a texto y líneas finas, sin áreas de color sólido,
# para ahorrar tinta al imprimir.
# ---------------------------------------------------------------------------
PRIMARY_HEX = "#0B2A4A"        # Azul navy institucional (texto y filetes)
PRIMARY = colors.HexColor(PRIMARY_HEX)
INK = colors.HexColor("#1A1A1A")        # texto principal, casi negro
GRAY = colors.HexColor("#6B7280")       # texto secundario / etiquetas
LINE = colors.HexColor("#C3CBD4")       # líneas finas de separación
BORDER = colors.HexColor("#9AA5B1")     # bordes de tiles/celdas (sin relleno)
ALERT_INK = colors.HexColor("#8A3B23")  # texto de alerta (alergias) — sin fondo

PAGE_W, PAGE_H = letter
MARGIN = 16 * mm
FOOTER_H = 10 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

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


def _format_unidad(value, unidad):
    """Formatea un signo vital con su unidad, o '—' si no hay dato."""
    formateado = _format_value(value)
    if formateado == "—":
        return formateado
    return f"{formateado} {unidad}"


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
    styles.add(ParagraphStyle("ClinicaNombre", fontName="Helvetica-Bold", fontSize=12.5,
                               textColor=PRIMARY, leading=14))
    styles.add(ParagraphStyle("ClinicaFoot", fontName="Helvetica", fontSize=7,
                               textColor=GRAY, leading=9))
    styles.add(ParagraphStyle("PacienteNombre", fontName="Helvetica-Bold", fontSize=13,
                               textColor=INK, leading=16))
    styles.add(ParagraphStyle("HeaderLabel", fontName="Helvetica-Bold", fontSize=6.6,
                               textColor=GRAY, leading=8.5, spaceAfter=1))
    styles.add(ParagraphStyle("HeaderValue", fontName="Helvetica", fontSize=8.8,
                               textColor=INK, leading=11))
    styles.add(ParagraphStyle("BadgeLabel", fontName="Helvetica-Bold", fontSize=6.6,
                               textColor=GRAY, leading=8.5, alignment=1))
    styles.add(ParagraphStyle("BadgeValue", fontName="Helvetica-Bold", fontSize=11.5,
                               textColor=PRIMARY, leading=14, alignment=1))
    styles.add(ParagraphStyle("BadgeHora", fontName="Helvetica", fontSize=8.6,
                               textColor=INK, leading=11, alignment=1))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=10,
                               textColor=PRIMARY, leading=12))
    styles.add(ParagraphStyle("TileLabel", fontName="Helvetica-Bold", fontSize=6.6,
                               textColor=GRAY, leading=8.5))
    styles.add(ParagraphStyle("TileValue", fontName="Helvetica-Bold", fontSize=11.5,
                               textColor=INK, leading=14))
    styles.add(ParagraphStyle("Label", fontName="Helvetica-Bold", fontSize=6.8,
                               textColor=GRAY, leading=9, spaceAfter=1))
    styles.add(ParagraphStyle("Value", fontName="Helvetica", fontSize=8.8,
                               textColor=INK, leading=11.5))
    styles.add(ParagraphStyle("ValueAlert", parent=styles["Value"], textColor=ALERT_INK,
                               fontName="Helvetica-Bold"))
    return styles


# ---------------------------------------------------------------------------
# Fondo de cada página: solo texto y una línea fina de pie — nada de
# rellenos, degradados ni marca de agua.
# ---------------------------------------------------------------------------
def _draw_page_furniture(canvas, doc, registro):
    canvas.saveState()
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica", 6.6)
    footer_left = f"Registro N.º {registro.id}"
    if CONSULTORIO_TELEFONO or CONSULTORIO_REGISTRO:
        extra = " · ".join(filter(None, [CONSULTORIO_TELEFONO, CONSULTORIO_REGISTRO]))
        footer_left = f"{footer_left}   |   {extra}"
    canvas.drawString(MARGIN, 7 * mm, footer_left)
    canvas.drawRightString(PAGE_W - MARGIN, 7 * mm, f"Página {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 10 * mm, PAGE_W - MARGIN, 10 * mm)
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Bloques reutilizables
# ---------------------------------------------------------------------------
def _section_title(title, styles):
    """Título de sección: texto + filete navy fino debajo (sin barra sólida)."""
    t = Table([[Paragraph(title, styles["SectionTitle"])]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.9, PRIMARY),
    ]))
    return t


def _empty_tile():
    """Celda vacía usada para rellenar la grilla de signos vitales."""
    wrap = Table([[""]], colWidths=[None], rowHeights=[1])
    wrap.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return wrap


def _stat_tile(label, value, styles):
    """Celda de signo vital: solo borde fino, sin relleno de color."""
    inner = Table(
        [[Paragraph(label.upper(), styles["TileLabel"])], [Paragraph(str(value), styles["TileValue"])]],
        colWidths=[None],
    )
    inner.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (0, 0), 7), ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, 1), (0, 1), 0), ("BOTTOMPADDING", (0, 1), (0, 1), 7),
        ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return inner


def _stat_grid(rows, styles, ncols=4, gutter=6):
    tiles = [_stat_tile(label, value, styles) for label, value in rows]
    grid_rows = []
    for i in range(0, len(tiles), ncols):
        chunk = tiles[i:i + ncols]
        while len(chunk) < ncols:
            chunk.append(_empty_tile())
        grid_rows.append(chunk)
    col_w = (CONTENT_W - gutter * (ncols - 1)) / ncols
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
        ("LINEBELOW", (0, 0), (-1, -2), 0.6, LINE),
    ]))
    return table


def _section(title, rows, styles, ncols=2):
    """Sección con título + filete fino (sin barra lateral ni fondo de color)."""
    body = _kv_grid(rows, styles, ncols, CONTENT_W)
    wrap = Table([[_section_title(title, styles)], [body]], colWidths=[CONTENT_W])
    wrap.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 1), (0, 1), 6), ("BOTTOMPADDING", (0, 1), (0, 1), 0),
    ]))
    return wrap


def _header_block(registro, styles):
    """Logo + nombre del consultorio a la izquierda, fecha/hora en una
    caja con solo borde a la derecha. Sin fondos de color."""
    logo = _get_logo()
    clinica = Table(
        [[Paragraph(CONSULTORIO_NOMBRE_L1, styles["ClinicaNombre"])],
         [Paragraph(CONSULTORIO_NOMBRE_L2, styles["ClinicaNombre"])]],
        colWidths=[None],
    )
    clinica.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    if logo is not None:
        img_w, img_h = logo.getSize()
        target_h = 15 * mm
        ratio = target_h / img_h
        logo_img = Image(IMAGE_PATH, width=img_w * ratio, height=target_h)
        left = Table([[logo_img, clinica]], colWidths=[18 * mm, None])
        left.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
    else:
        left = clinica

    badge = Table(
        [[Paragraph("FECHA DE ATENCIÓN", styles["BadgeLabel"])],
         [Paragraph(_format_value(registro.fecha), styles["BadgeValue"])],
         [Paragraph(f"{_format_value(registro.hora)} hrs", styles["BadgeHora"])]],
        colWidths=[42 * mm],
    )
    badge.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
        ("ROUNDEDCORNERS", [5, 5, 5, 5]),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))

    header = Table([[left, badge]], colWidths=[CONTENT_W - 42 * mm, 42 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return header


def _paciente_block(paciente, styles):
    """Nombre del paciente + grilla de datos, sin fondos ni bordes de color."""
    nombre = f"{paciente.nombres} {paciente.apellidos}" if paciente else "Paciente no registrado"
    nombre_p = Paragraph(nombre, styles["PacienteNombre"])

    rows = [
        ("Documento", _format_value(paciente.documento) if paciente else "—"),
        ("Edad · Sexo", f"{_calcular_edad(paciente.fecha_nacimiento) if paciente else '—'} · "
                        f"{_format_value(paciente.sexo) if paciente else '—'}"),
        ("Teléfono", _format_value(paciente.telefono) if paciente else "—"),
        ("Dirección", _format_value(paciente.direccion) if paciente else "—"),
    ]
    cells = [
        Table(
            [[Paragraph(label.upper(), styles["HeaderLabel"])], [Paragraph(str(value), styles["HeaderValue"])]],
            colWidths=[None],
        )
        for label, value in rows
    ]
    grid = Table([cells], colWidths=[CONTENT_W / len(cells)] * len(cells))
    grid.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    block = Table([[nombre_p], [Spacer(1, 5)], [grid]], colWidths=[CONTENT_W])
    block.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return block


def _build_registro_pdf(registro: RegistroClinico) -> bytes:
    buffer = BytesIO()
    styles = _styles()

    paciente = registro.paciente

    doc = BaseDocTemplate(
        buffer, pagesize=letter,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=FOOTER_H + 4 * mm,
    )
    main_frame = Frame(
        MARGIN, FOOTER_H + 4 * mm, CONTENT_W, PAGE_H - MARGIN - FOOTER_H - 4 * mm, id="main",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates([
        PageTemplate(id="registro", frames=[main_frame],
                     onPage=lambda c, d: _draw_page_furniture(c, d, registro))
    ])

    story = []

    # ---------------- Encabezado: logo + clínica, fecha/hora ----------------
    story.append(_header_block(registro, styles))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.1, color=PRIMARY, spaceAfter=8))

    # ---------------- Datos del paciente ----------------
    story.append(_paciente_block(paciente, styles))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=10))

    # ---------------- Signos vitales (8 — incluye SpO2 y glicemia) ----------------
    signos_rows = [
        ("Presión arterial", _format_unidad(registro.presion_arterial, "mmHg")),
        ("Frec. cardiaca", _format_unidad(registro.frecuencia_cardiaca, "lpm")),
        ("Frec. respiratoria", _format_unidad(registro.frecuencia_respiratoria, "rpm")),
        ("Saturación O2", _format_unidad(registro.saturacion_oxigeno, "%")),
        ("Temperatura", _format_unidad(registro.temperatura, "°C")),
        ("Glicemia", _format_unidad(registro.glicemia, "mg/dL")),
        ("Peso", _format_unidad(registro.peso, "kg")),
        ("Talla", _format_unidad(registro.talla, "m")),
    ]
    story.append(_section_title("SIGNOS VITALES", styles))
    story.append(Spacer(1, 6))
    story.append(_stat_grid(signos_rows, styles, ncols=4))
    story.append(Spacer(1, 10))

    # ---------------- Evaluación clínica (incluye hallazgos ecográficos) ----------------
    consulta_rows = [
        ("Motivo de consulta", _format_value(registro.motivo_consulta), False),
        ("Enfermedad actual", _format_value(registro.enfermedad_actual), False),
        ("Examen físico", _format_value(registro.examen_fisico), False),
        ("Hallazgos ecográficos", _format_value(registro.hallazgos_ecograficos), False),
        ("Diagnóstico", _format_value(registro.diagnostico), False),
        ("Tratamiento", _format_value(registro.tratamiento), False),
    ]
    story.append(_section("EVALUACIÓN CLÍNICA", consulta_rows, styles, ncols=1))
    story.append(Spacer(1, 10))

    # ---------------- Seguimiento y alertas ----------------
    tiene_alergias = bool(registro.alergias) and str(registro.alergias).strip() not in ("", "—")
    control_rows = [
        ("Consulta de control", _format_value(registro.consulta_control), False),
        ("Alergias", _format_value(registro.alergias), tiene_alergias),
        ("Observaciones", _format_value(registro.observaciones), False),
    ]
    story.append(_section(
        "SEGUIMIENTO Y ALERTAS" if tiene_alergias else "SEGUIMIENTO",
        control_rows, styles, ncols=2,
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
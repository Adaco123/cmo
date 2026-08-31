"""Generación del PDF de FIRMA DE CONSENTIMIENTO DEL PACIENTE EN CASO DE
PROCEDIMIENTO — documento breve que firma el paciente autorizando un
procedimiento específico indicado por el médico tratante, con espacio
para describir el procedimiento y registrar la evolución.

Mismo lenguaje visual "bajo consumo de tinta" que reporte.py: sin
fondos de color sólido, sin degradados, solo texto y líneas finas.

Se descarga directo (sin pedir datos adicionales) a partir de un
registro clínico existente, igual que el reporte del registro.
"""
import os
from datetime import date, datetime
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

historial_clinico_consentimiento_bp = Blueprint("historial_clinico_consentimiento", __name__)

# ---------------------------------------------------------------------------
# Datos del consultorio (mismos que reporte.py — ajustar con la info real)
# ---------------------------------------------------------------------------
CONSULTORIO_NOMBRE_L1 = "CONSULTORES"
CONSULTORIO_NOMBRE_L2 = "MEDICOS ORURO"
CONSULTORIO_TELEFONO = ""
CONSULTORIO_REGISTRO = ""

# ---------------------------------------------------------------------------
# Paleta — igual que reporte.py: texto y líneas finas, sin áreas de color
# sólido, para ahorrar tinta al imprimir.
# ---------------------------------------------------------------------------
PRIMARY_HEX = "#0B2A4A"
PRIMARY = colors.HexColor(PRIMARY_HEX)
INK = colors.HexColor("#1A1A1A")
GRAY = colors.HexColor("#6B7280")
LINE = colors.HexColor("#C3CBD4")
BORDER = colors.HexColor("#9AA5B1")

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


def _calcular_edad(fecha_nacimiento):
    if not fecha_nacimiento or not hasattr(fecha_nacimiento, "year"):
        return "—"
    hoy = date.today()
    if fecha_nacimiento > hoy:
        return "—"
    edad = hoy.year - fecha_nacimiento.year - (
        (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )
    return f"{edad} años"


def _nombre_medico(registro):
    medico = registro.medico
    if not medico or not medico.empleado:
        return "—"
    matricula = f" · Matrícula {medico.matricula_profesional}" if medico.matricula_profesional else ""
    return f"{medico.empleado.nombres} {medico.empleado.apellidos}{matricula}"


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("ClinicaNombre", fontName="Helvetica-Bold", fontSize=12.5,
                               textColor=PRIMARY, leading=14))
    styles.add(ParagraphStyle("DocTitulo", fontName="Helvetica-Bold", fontSize=14,
                               textColor=PRIMARY, leading=17, alignment=1, spaceBefore=2))
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
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=10,
                               textColor=PRIMARY, leading=12))
    styles.add(ParagraphStyle("Label", fontName="Helvetica-Bold", fontSize=6.8,
                               textColor=GRAY, leading=9, spaceAfter=1))
    styles.add(ParagraphStyle("Value", fontName="Helvetica", fontSize=8.8,
                               textColor=INK, leading=11.5))
    styles.add(ParagraphStyle("FirmaLabel", fontName="Helvetica", fontSize=7.6,
                               textColor=GRAY, leading=10, alignment=1))
    styles.add(ParagraphStyle("CILabel", fontName="Helvetica-Bold", fontSize=9.5,
                               textColor=INK, leading=12, alignment=0))
    return styles


# ---------------------------------------------------------------------------
# Fondo de página: pie con línea fina + aviso — sin rellenos ni marca de agua.
# ---------------------------------------------------------------------------
def _draw_page_furniture(canvas, doc, registro, generado_en):
    canvas.saveState()
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica-Oblique", 6.2)
    aviso = f"Documento generado el {generado_en}"
    canvas.drawString(MARGIN, 11.8 * mm, aviso)

    canvas.setFont("Helvetica", 6.6)
    footer_left = f"Registro N.º {registro.id} · Consentimiento de procedimiento"
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
    t = Table([[Paragraph(title, styles["SectionTitle"])]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.9, PRIMARY),
    ]))
    return t


def _blank_lines(n, line_height=9 * mm):
    """N líneas horizontales en blanco para escribir a mano, espaciadas
    uniformemente. Sin relleno de color."""
    rows = [[""] for _ in range(n)]
    t = Table(rows, colWidths=[CONTENT_W], rowHeights=[line_height] * n)
    style = [
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]
    for i in range(n):
        style.append(("LINEBELOW", (0, i), (0, i), 0.6, LINE))
    t.setStyle(TableStyle(style))
    return t


def _header_block(registro, styles):
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
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
    else:
        left = clinica

    badge = Table(
        [[Paragraph("FECHA", styles["BadgeLabel"])],
         [Paragraph(_format_value(date.today().isoformat()), styles["BadgeValue"])]],
        colWidths=[38 * mm],
    )
    badge.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
        ("ROUNDEDCORNERS", [5, 5, 5, 5]),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))

    header = Table([[left, badge]], colWidths=[CONTENT_W - 38 * mm, 38 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return header


def _paciente_block(paciente, styles):
    nombre = f"{paciente.nombres} {paciente.apellidos}" if paciente else "Paciente no registrado"
    nombre_p = Paragraph(nombre, styles["PacienteNombre"])

    rows = [
        ("Documento", _format_value(paciente.documento) if paciente else "—"),
        ("Edad · Sexo", f"{_calcular_edad(paciente.fecha_nacimiento) if paciente else '—'} · "
                        f"{_format_value(paciente.sexo) if paciente else '—'}"),
        ("Teléfono", _format_value(paciente.telefono) if paciente else "—"),
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


def _firma_ci_row(paciente, styles):
    """Fila con la línea de firma a la izquierda y el C.I. del paciente
    a la derecha."""
    firma_cell = Table(
        [[""], [Paragraph("Firma", styles["FirmaLabel"])]],
        colWidths=[None],
    )
    firma_cell.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (0, 0), 0.8, INK),
        ("TOPPADDING", (0, 0), (0, 0), 26), ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, 1), (0, 1), 3), ("BOTTOMPADDING", (0, 1), (0, 1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (0, 0), (0, 1), "LEFT"),
    ]))

    ci_valor = _format_value(paciente.documento) if paciente else "—"
    ci_cell = Table(
        [[Paragraph(f"C.I: {ci_valor}", styles["CILabel"])]],
        colWidths=[None],
    )
    ci_cell.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
    ]))

    row = Table([[firma_cell, ci_cell]], colWidths=[CONTENT_W * 0.62, CONTENT_W * 0.38])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return row


def _build_consentimiento_pdf(registro: RegistroClinico) -> bytes:
    buffer = BytesIO()
    styles = _styles()
    paciente = registro.paciente
    generado_en = datetime.now().strftime("%d/%m/%Y %H:%M")

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
        PageTemplate(id="consentimiento", frames=[main_frame],
                     onPage=lambda c, d: _draw_page_furniture(c, d, registro, generado_en))
    ])

    story = []

    # ---------------- Encabezado ----------------
    story.append(_header_block(registro, styles))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "FIRMA DE CONSENTIMIENTO DEL PACIENTE EN CASO DE PROCEDIMIENTO", styles["DocTitulo"]
    ))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.1, color=PRIMARY, spaceAfter=8))

    # ---------------- Datos del paciente ----------------
    story.append(_paciente_block(paciente, styles))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=10))

    # ---------------- Descripción del procedimiento ----------------
    story.append(_section_title("DESCRIPCIÓN DEL PROCEDIMIENTO:", styles))
    story.append(Spacer(1, 8))
    story.append(_blank_lines(2))
    story.append(Spacer(1, 22))

    # ---------------- Firma + C.I. ----------------
    story.append(_firma_ci_row(paciente, styles))
    story.append(Spacer(1, 20))

    # ---------------- Evolución ----------------
    story.append(_section_title("EVOLUCIÓN", styles))
    story.append(Spacer(1, 8))
    story.append(_blank_lines(4))

    doc.build(story)
    return buffer.getvalue()


@historial_clinico_consentimiento_bp.get("/registro/<int:registro_id>/consentimiento")
@jwt_required()
def generar_consentimiento(registro_id):
    registro = RegistroClinico.get_by_id(registro_id)
    if not registro:
        return jsonify({"error": "Registro clínico no encontrado"}), 404

    pdf_bytes = _build_consentimiento_pdf(registro)
    buffer = BytesIO(pdf_bytes)
    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=False,
        download_name=f"consentimiento_{registro_id}.pdf",
    )
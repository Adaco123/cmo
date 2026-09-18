"""Schemas (Marshmallow) del módulo historial_clinico:
HistoriaClinica y RegistroClinico.
"""

from marshmallow import Schema, fields, validate


class HistoriaClinicaSchema(Schema):
    id = fields.Integer(dump_only=True)

    paciente_id = fields.Integer(required=True)

    fecha_apertura = fields.DateTime(dump_only=True)

    estado = fields.Boolean(load_default=True)

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class RegistroClinicoSchema(Schema):
    id = fields.Integer(dump_only=True)

    # ============================================================
    # RELACIONES
    # ============================================================

    historia_clinica_id = fields.Integer(dump_only=True)

    consulta_id = fields.Integer(required=True)

    # ============================================================
    # SIGNOS VITALES — presión, FC, SpO2, temperatura y peso son
    # obligatorios (mismo criterio que ya usa el frontend en
    # vitalesObligatorios de RegistroClinico.tsx); frecuencia
    # respiratoria, glicemia y talla son opcionales pero, si vienen,
    # se validan igual.
    # ============================================================

    presion_arterial = fields.String(
        required=True,
        validate=validate.Length(max=15)
    )

    frecuencia_cardiaca = fields.Integer(
        required=True,
        validate=validate.Range(min=0, max=300, error="Debe estar entre 0 y 300 lpm")
    )

    frecuencia_respiratoria = fields.Integer(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=0, max=100, error="Debe estar entre 0 y 100 rpm")
    )

    saturacion_oxigeno = fields.Integer(
        required=True,
        validate=validate.Range(min=0, max=100, error="Debe estar entre 0 y 100 %")
    )

    glicemia = fields.Decimal(
        required=False,
        allow_none=True,
        load_default=None,
        as_string=True,
        places=1,
        validate=validate.Range(min=0, max=1000, error="Debe estar entre 0 y 1000 mg/dL")
    )

    temperatura = fields.Decimal(
        required=True,
        as_string=True,
        places=1,
        validate=validate.Range(min=25, max=45, error="Debe estar entre 25 y 45 °C")
    )

    peso = fields.Decimal(
        required=True,
        as_string=True,
        places=2,
        validate=validate.Range(min=0, max=300, error="Debe estar entre 0 y 300 kg")
    )

    talla = fields.Decimal(
        required=False,
        allow_none=True,
        load_default=None,
        as_string=True,
        places=2,
        validate=validate.Range(min=0.3, max=2.5, error="Debe estar entre 0.3 y 2.5 m")
    )

    # ============================================================
    # INFORMACIÓN CLÍNICA
    # ============================================================

    hallazgos_ecograficos = fields.String(
        required=True,
        validate=validate.Length(max=200)
    )

    enfermedad_actual = fields.String(
        allow_none=True
    )

    examen_fisico = fields.String(
        allow_none=True
    )

    tratamiento = fields.String(
        allow_none=True
    )

    # 👇 Antes era fields.Date — ahora el doctor lo anota como texto
    # libre en el mismo formulario ("antibiótico 7 días, control por
    # persistencia de fiebre"), ya no como una fecha exacta.
    consulta_control = fields.String(
        allow_none=True
    )

    alergias = fields.String(
        allow_none=True
    )

    observaciones = fields.String(
        allow_none=True
    )

    # ============================================================
    # PDF
    # ============================================================

    pdf_generado = fields.Boolean(
        dump_only=True
    )

    pdf_ruta = fields.String(
        dump_only=True,
        allow_none=True
    )

    # ============================================================
    # DATOS DERIVADOS DE CONSULTA
    # ============================================================

    fecha = fields.Date(
        dump_only=True
    )

    hora = fields.Time(
        dump_only=True
    )

    medico_id = fields.Integer(
        dump_only=True,
        attribute="medico.id"
    )

    diagnostico = fields.String(
        dump_only=True
    )

    motivo_consulta = fields.String(
        dump_only=True
    )

    # ============================================================
    # AUDITORÍA
    # ============================================================

    created_at = fields.DateTime(
        dump_only=True
    )

    updated_at = fields.DateTime(
        dump_only=True
    )
class SeguimientoControlSchema(Schema):
    id = fields.Int(dump_only=True)
    paciente_id = fields.Int(dump_only=True)
    registro_clinico_id = fields.Int(required=True)
    medico_id = fields.Int(required=True)
    fecha = fields.Date(dump_only=True)
    evolucion = fields.Str(required=True, validate=validate.Length(min=1))
    proxima_fecha_control = fields.Date(allow_none=True, load_default=None)
    hora_inicio = fields.Time(allow_none=True, load_default=None)
    hora_fin = fields.Time(allow_none=True, load_default=None)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
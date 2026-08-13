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

    # Lo asigna automáticamente el Resource a partir de
    # consulta.paciente_id.
    historia_clinica_id = fields.Integer(dump_only=True)

    # El cliente debe indicar a qué consulta pertenece
    # el registro clínico.
    consulta_id = fields.Integer(required=True)

    # ============================================================
    # SIGNOS VITALES - TODOS OBLIGATORIOS
    # ============================================================

    presion_arterial = fields.String(
        required=True,
        validate=validate.Length(max=15)
    )

    frecuencia_cardiaca = fields.Integer(
        required=True
    )

    frecuencia_respiratoria = fields.Integer(
        required=True
    )

    saturacion_oxigeno = fields.Integer(
        required=True
    )

    glicemia = fields.Decimal(
        required=True,
        as_string=True,
        places=1
    )

    temperatura = fields.Decimal(
        required=True,
        as_string=True,
        places=1
    )

    peso = fields.Decimal(
        required=True,
        as_string=True,
        places=2
    )

    talla = fields.Decimal(
        required=True,
        as_string=True,
        places=2
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

    consulta_control = fields.Date(
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

    # Actualmente no existen como columnas en el modelo
    # RegistroClinico. Si tu Resource las genera dinámicamente,
    # pueden mantenerse como dump_only.
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
    #
    # Estos valores NO los manda el cliente.
    # Se obtienen mediante las propiedades del modelo:
    #
    # registro.consulta.fecha
    # registro.consulta.hora
    # registro.consulta.medico
    # registro.consulta.diagnostico
    # registro.consulta.motivo
    #

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

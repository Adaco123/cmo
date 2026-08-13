"""Schemas Marshmallow del módulo citas."""
from marshmallow import fields, validate
from app.extensions import ma


class CitaSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    paciente_id = fields.Int(required=True)
    medico_id = fields.Int(required=True)
    consultorio_id = fields.Int(allow_none=True)
    fecha = fields.Date(required=True)
    hora_inicio = fields.Time(required=True)
    hora_fin = fields.Time(required=True, allow_none=True)
    motivo = fields.Str(allow_none=True)
    estado_id = fields.Int(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

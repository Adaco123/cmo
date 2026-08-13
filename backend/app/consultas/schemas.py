"""Schemas Marshmallow del módulo consultas."""
from marshmallow import fields, validate
from app.extensions import ma


class ConsultaSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    cita_id = fields.Int(allow_none=True)
    paciente_id = fields.Int(required=True)
    medico_id = fields.Int(required=True)
    fecha = fields.Date(required=True)
    hora = fields.Time(required=True)
    motivo = fields.Str(allow_none=True)
    diagnostico = fields.Str(allow_none=True)
    
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

"""Schemas Marshmallow del módulo medicos."""
from marshmallow import fields, validate
from app.extensions import ma


class MedicoSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    empleado_id = fields.Int(required=True)
    especialidad = fields.Str(required=True)
    matricula_profesional = fields.Str(required=True)
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

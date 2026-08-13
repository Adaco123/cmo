"""Schemas Marshmallow del módulo origenes_paciente."""
from marshmallow import fields, validate
from app.extensions import ma


class OrigenPacienteSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

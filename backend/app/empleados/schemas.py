"""Schemas Marshmallow del módulo empleados."""
from marshmallow import fields, validate
from app.extensions import ma


class EmpleadoSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    usuario_id = fields.Int(required=True)
    consultorio_id = fields.Int(allow_none=True)
    nombres = fields.Str(required=True)
    apellidos = fields.Str(required=True)
    documento = fields.Str(required=True)
    telefono = fields.Str(allow_none=True)
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

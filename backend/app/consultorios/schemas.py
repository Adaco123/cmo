"""Schemas Marshmallow del módulo consultorios."""
from marshmallow import fields, validate
from app.extensions import ma


class ConsultorioSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True)
    direccion = fields.Str(allow_none=True)
    telefono = fields.Str(allow_none=True)
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

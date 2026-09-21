"""Schemas Marshmallow del módulo consultorios."""
from marshmallow import fields, validate
from app.extensions import ma


class ConsultorioSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True, validate=validate.Length(min=1, max=150))
    direccion = fields.Str(allow_none=True, validate=validate.Length(max=200))
    telefono = fields.Str(allow_none=True, validate=validate.Length(max=30))
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
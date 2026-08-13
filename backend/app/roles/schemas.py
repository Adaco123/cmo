"""Schemas Marshmallow del módulo roles."""
from marshmallow import fields, validate
from app.extensions import ma


class RolSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True)
    descripcion = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

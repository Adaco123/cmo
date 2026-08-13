"""Schemas Marshmallow del módulo metodos_pago."""
from marshmallow import fields, validate
from app.extensions import ma


class MetodoPagoSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

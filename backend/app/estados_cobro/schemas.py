"""Schemas Marshmallow del módulo estados_cobro."""
from marshmallow import fields, validate
from app.extensions import ma


class EstadoCobroSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

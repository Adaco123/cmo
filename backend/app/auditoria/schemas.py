"""Schemas Marshmallow del módulo auditoria."""
from marshmallow import fields, validate
from app.extensions import ma


class AuditoriaSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    usuario_id = fields.Int(allow_none=True)
    accion = fields.Str(required=True)
    tabla_afectada = fields.Str(required=True)
    registro_id = fields.Int(allow_none=True)
    detalle = fields.Raw(allow_none=True)
    fecha_hora = fields.DateTime(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

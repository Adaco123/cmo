"""Schemas Marshmallow del módulo modelos_informe."""
from marshmallow import fields, validate
from app.extensions import ma


class ModeloInformeSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombre = fields.Str(required=True)
    categoria_id = fields.Int(required=True)
    descripcion = fields.Str(allow_none=True)
    contenido_base = fields.Str(required=True)
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

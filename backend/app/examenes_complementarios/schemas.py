"""Schema (Marshmallow) del módulo examenes_complementarios."""
from marshmallow import fields, validate
from app.extensions import ma


class CategoriaExamenSchema(ma.Schema):
    id = fields.Integer(dump_only=True)
    nombre = fields.String(required=True, validate=validate.Length(max=60))

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class ExamenComplementarioSchema(ma.Schema):
    id = fields.Integer(dump_only=True)

    registro_clinico_id = fields.Integer(required=True)
    categoria_id = fields.Integer(required=True)

    nombre_examen = fields.String(required=True, validate=validate.Length(max=200))
    resultado = fields.String(allow_none=True)
    observaciones = fields.String(allow_none=True, validate=validate.Length(max=300))
    fecha = fields.Date(dump_only=True)

    estado = fields.Boolean(load_default=True)

    categoria = fields.Nested(CategoriaExamenSchema, dump_only=True)

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
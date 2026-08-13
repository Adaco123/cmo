"""Schemas Marshmallow del módulo informes_ecografia."""
from marshmallow import fields, validate
from app.extensions import ma


class InformeEcografiaSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    registro_clinico_id = fields.Int(required=True)
    modelo_id = fields.Int(allow_none=True)
    medico_id = fields.Int(required=True)
    fecha = fields.Date()
    contenido_final = fields.Str(required=True)
    conclusion = fields.Str(allow_none=True)
    observaciones = fields.Str(allow_none=True)
    pdf_ruta = fields.Str(allow_none=True)
    estado = fields.Str(validate=validate.OneOf(['BORRADOR', 'CERRADO', 'ANULADO']))
    fecha_cierre = fields.DateTime(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

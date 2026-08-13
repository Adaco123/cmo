"""Schemas Marshmallow del módulo cobros."""
from marshmallow import fields, validate
from app.extensions import ma


class CobroSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    consulta_id = fields.Int(required=True)
    paciente_id = fields.Int(required=True)
    monto = fields.Decimal(required=True, as_string=True)
    descuento = fields.Decimal(as_string=True)
    monto_final = fields.Decimal(required=True, as_string=True)
    estado_id = fields.Int(required=True)
    numero_recibo = fields.Str(required=True)
    fecha = fields.Date()
    usuario_id = fields.Int(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

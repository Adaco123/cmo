"""Schemas Marshmallow del módulo pagos."""
from marshmallow import INCLUDE, fields, validate
from app.extensions import ma


class PagoSchema(ma.Schema):
    class Meta:
        unknown = INCLUDE

    id = fields.Int(dump_only=True)
    cobro_id = fields.Int(required=False, allow_none=True)
    monto = fields.Decimal(required=True, as_string=True)
    metodo_pago_id = fields.Int(required=True)
    numero_recibo_pago = fields.Str(required=False, load_default=None)
    referencia = fields.Str(allow_none=True)
    #pagos_hoy = fields.Method("obtener_pagos_hoy", dump_only=True)
    usuario_id = fields.Int(required=False, load_default=None)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    
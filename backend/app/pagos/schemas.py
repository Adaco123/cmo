"""Schemas Marshmallow del módulo pagos."""
from marshmallow import EXCLUDE, fields, validate
from app.extensions import ma


class PagoSchema(ma.Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    cobro_id = fields.Int(required=False, allow_none=True)
    monto = fields.Decimal(
        required=True, as_string=True,
        validate=validate.Range(min=0, min_inclusive=False, error="monto debe ser mayor a 0."),
    )
    metodo_pago_id = fields.Int(required=True)
    numero_recibo_pago = fields.Str(required=False, load_default=None)
    referencia = fields.Str(allow_none=True)
    #pagos_hoy = fields.Method("obtener_pagos_hoy", dump_only=True)
    usuario_id = fields.Int(required=False, load_default=None)
    # Usados solo en el flujo de crear cobro+pago en un mismo POST (sin
    # cobro_id): no son columnas de Pago, pero se declaran aquí para que
    # se validen en vez de colar sin control con unknown=INCLUDE.
    descuento = fields.Decimal(
        required=False, allow_none=True, as_string=True,
        validate=validate.Range(min=0, error="descuento no puede ser negativo."),
    )
    monto_pago = fields.Decimal(
        required=False, allow_none=True, as_string=True,
        validate=validate.Range(min=0, min_inclusive=False, error="monto_pago debe ser mayor a 0."),
    )
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
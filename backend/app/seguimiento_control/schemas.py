"""Schema del módulo seguimiento_control."""
from marshmallow import Schema, fields, validate


class SeguimientoControlSchema(Schema):
    id = fields.Int(dump_only=True)
    registro_clinico_id = fields.Int(required=True)
    medico_id = fields.Int(required=True)
    fecha = fields.Date(dump_only=True)
    evolucion = fields.Str(required=True, validate=validate.Length(min=1))
    proxima_fecha_control = fields.Date(allow_none=True, load_default=None)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
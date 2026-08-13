"""Schemas Marshmallow del módulo archivos."""
from marshmallow import fields, validate
from app.extensions import ma


class ArchivoSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    registro_clinico_id = fields.Int(allow_none=True)
    informe_id = fields.Int(allow_none=True)
    tipo_archivo_id = fields.Int(required=True)
    nombre_archivo = fields.Str(required=True)
    ruta_almacenamiento = fields.Str(required=True)
    tamano_bytes = fields.Int(allow_none=True)
    subido_por_usuario_id = fields.Int(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

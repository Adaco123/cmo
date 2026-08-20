"""Schema del módulo archivos."""
from marshmallow import Schema, fields


class ArchivoSchema(Schema):
    id = fields.Integer(dump_only=True)

    registro_clinico_id = fields.Integer(allow_none=True)
    informe_id = fields.Integer(allow_none=True)
    receta_id = fields.Integer(allow_none=True)
    examen_complementario_id = fields.Integer(allow_none=True)

    tipo_archivo_id = fields.Integer(required=True)
    nombre_archivo = fields.String(dump_only=True)
    ruta_almacenamiento = fields.String(dump_only=True)
    tamano_bytes = fields.Integer(dump_only=True)
    subido_por_usuario_id = fields.Integer(dump_only=True)

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
"""Schemas Marshmallow del módulo usuarios."""
from marshmallow import fields, validate
from app.extensions import ma


class UsuarioSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    usuario = fields.Str(required=True)
    contrasena_hash = fields.Str(required=True, load_only=True)
    correo = fields.Email(required=True)
    rol_id = fields.Int(required=True)
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

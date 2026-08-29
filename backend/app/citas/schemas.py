"""Schemas Marshmallow del módulo citas."""
from datetime import date

from marshmallow import fields, validate, validates_schema, ValidationError
from app.extensions import ma


class CitaSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    paciente_id = fields.Int(required=True)
    medico_id = fields.Int(required=True)
    consultorio_id = fields.Int(allow_none=True)
    fecha = fields.Date(required=True)
    hora_inicio = fields.Time(required=True)
    hora_fin = fields.Time(required=True)
    motivo = fields.Str(allow_none=True)
    estado_id = fields.Int(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    @validates_schema
    def validar_horario(self, data, **kwargs):
        fecha = data.get("fecha")
        hora_inicio = data.get("hora_inicio")
        hora_fin = data.get("hora_fin")

        if fecha and fecha < date.today():
            raise ValidationError(
                "La fecha de la cita no puede ser pasada.", field_name="fecha"
            )

        if hora_inicio and hora_fin and hora_fin <= hora_inicio:
            raise ValidationError(
                "hora_fin debe ser posterior a hora_inicio.", field_name="hora_fin"
            )
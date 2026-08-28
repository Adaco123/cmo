"""Schemas Marshmallow del módulo pacientes."""
import re
from datetime import date

from marshmallow import fields, validate, ValidationError
from app.extensions import ma

# --- Regex reutilizables ---
RE_DOCUMENTO = re.compile(r'^\d{5,10}(-\d{1,2}[A-Za-z]{0,2})?$')
RE_TELEFONO = re.compile(r'^\+?[\d\s\-]{7,15}$')
RE_NOMBRE = re.compile(r'^[A-Za-zÁÉÍÓÚÑáéíóúñÜü\s]{2,100}$')


def validar_fecha_nacimiento(value: date):
    hoy = date.today()
    if value > hoy:
        raise ValidationError("La fecha de nacimiento no puede ser futura.")
    edad_maxima = hoy.replace(year=hoy.year - 120)
    if value < edad_maxima:
        raise ValidationError("La fecha de nacimiento no es válida (edad mayor a 120 años).")


class PacienteSchema(ma.Schema):
    id = fields.Int(dump_only=True)

    nombres = fields.Str(
        required=True,
        validate=[
            validate.Length(min=2, max=100),
            validate.Regexp(RE_NOMBRE, error="Nombres solo puede contener letras y espacios."),
        ],
    )
    apellidos = fields.Str(
        required=True,
        validate=[
            validate.Length(min=2, max=100),
            validate.Regexp(RE_NOMBRE, error="Apellidos solo puede contener letras y espacios."),
        ],
    )
    documento = fields.Str(
        required=True,
        validate=[
            validate.Length(min=5, max=20),
            validate.Regexp(RE_DOCUMENTO, error="Formato de documento (CI) inválido."),
        ],
    )
    fecha_nacimiento = fields.Date(required=True, load_only=True, validate=validar_fecha_nacimiento)
    edad = fields.Method("calcular_edad", dump_only=True)
    alergias = fields.Method("obtener_alergias", dump_only=True)
    diagnostico = fields.Method("obtener_diagnostico", dump_only=True)
    sexo = fields.Str(required=True, validate=validate.OneOf(['M', 'F', 'O']))

    direccion = fields.Str(allow_none=True, validate=validate.Length(max=255))
    telefono = fields.Str(
        allow_none=True,
        validate=[
            validate.Length(max=20),
            validate.Regexp(RE_TELEFONO, error="Formato de teléfono inválido."),
        ],
    )
    correo = fields.Email(allow_none=True, validate=validate.Length(max=255))

    origen_id = fields.Int(required=True, validate=validate.OneOf([1, 2]))
    medico_referente_id = fields.Int(allow_none=True)
    medico_referente_externo = fields.Str(allow_none=True, validate=validate.Length(max=255))
    consultorio_id = fields.Int(allow_none=True)
    estado = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    def calcular_edad(self, paciente):
        fecha_nac = paciente.fecha_nacimiento
        hoy = date.today()

        edad = hoy.year - fecha_nac.year

        if (hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day):
            edad -= 1

        return edad

    def obtener_alergias(self, paciente):
        return paciente.obtener_alergias()

    def obtener_diagnostico(self, paciente):
        return paciente.obtener_ultimo_diagnostico()
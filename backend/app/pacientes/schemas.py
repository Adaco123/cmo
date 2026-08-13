"""Schemas Marshmallow del módulo pacientes."""
from marshmallow import fields, validate
from app.extensions import ma
from datetime import date

class PacienteSchema(ma.Schema):
    id = fields.Int(dump_only=True)
    nombres = fields.Str(required=True)
    apellidos = fields.Str(required=True)
    documento = fields.Str(required=True)
    fecha_nacimiento = fields.Date(required=True, load_only=True)
    edad = fields.Method("calcular_edad", dump_only=True)
    alergias =fields.Method("obtener_alergias", dump_only=True)
    diagnostico=fields.Method("obtener_diagnostico", dump_only=True)
    sexo = fields.Str(required=True, validate=validate.OneOf(['M', 'F', 'O']))
    direccion = fields.Str(allow_none=True)
    telefono = fields.Str(allow_none=True)
    correo = fields.Email(allow_none=True)
    
    origen_id = fields.Int(required=True)
    medico_referente_id = fields.Int(allow_none=True)
    medico_referente_externo = fields.Str(allow_none=True)
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
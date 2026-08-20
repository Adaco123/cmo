from marshmallow import fields, validate
from app.extensions import ma

class TipoRecetaSchema(ma.Schema):
    id = fields.Integer(dump_only=True)
    nombre = fields.String(required=True, validate=validate.Length(max=40))

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class RecetaMedicamentoSchema(ma.Schema):
    id = fields.Integer(dump_only=True)
    receta_id = fields.Integer(dump_only=True)  # se asigna desde la URL, no desde el body

    medicamento = fields.String(required=True, validate=validate.Length(max=200))
    dosis = fields.String(required=True, validate=validate.Length(max=60))
    via_administracion = fields.String(allow_none=True, validate=validate.Length(max=40))
    frecuencia = fields.String(required=True, validate=validate.Length(max=60))
    duracion = fields.String(allow_none=True, validate=validate.Length(max=60))
    cantidad = fields.String(allow_none=True, validate=validate.Length(max=30))
    indicaciones = fields.String(allow_none=True, validate=validate.Length(max=300))


class RecetaFormulaMagistralSchema(ma.Schema):
    id = fields.Integer(dump_only=True)
    receta_id = fields.Integer(dump_only=True)

    nombre_formula = fields.String(required=True, validate=validate.Length(max=200))
    ingredientes = fields.String(required=True)
    forma_farmaceutica = fields.String(allow_none=True, validate=validate.Length(max=60))
    cantidad_preparar = fields.String(allow_none=True, validate=validate.Length(max=60))
    via_administracion = fields.String(allow_none=True, validate=validate.Length(max=40))
    indicaciones = fields.String(allow_none=True, validate=validate.Length(max=300))


class RecetaExamenSchema(ma.Schema):
    id = fields.Integer(dump_only=True)
    receta_id = fields.Integer(dump_only=True)

    nombre_examen = fields.String(required=True, validate=validate.Length(max=200))
    tipo_examen = fields.String(required=True, validate=validate.Length(max=30))
    urgencia = fields.String(load_default="Rutina", validate=validate.Length(max=20))
    indicaciones_previas = fields.String(allow_none=True, validate=validate.Length(max=300))


class RecetaSchema(ma.Schema):
    id = fields.Integer(dump_only=True)

    registro_clinico_id = fields.Integer(required=True)
    tipo_receta_id = fields.Integer(required=True)
    medico_id = fields.Integer(required=True)
    seguimiento_control_id = fields.Integer(dump_only=True, allow_none=True)
    fecha = fields.Date(dump_only=True)
    indicaciones_generales = fields.String(allow_none=True)
    estado = fields.Boolean(load_default=True)
    
    # Detalles anidados, solo lectura (se gestionan con sus propios endpoints,
    # no se cargan directo al crear/editar la receta)
    medicamentos = fields.Nested(RecetaMedicamentoSchema, many=True, dump_only=True)
    formulas_magistrales = fields.Nested(RecetaFormulaMagistralSchema, many=True, dump_only=True)
    examenes = fields.Nested(RecetaExamenSchema, many=True, dump_only=True)

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
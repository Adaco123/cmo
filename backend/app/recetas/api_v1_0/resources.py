"""Rutas del módulo recetas."""
from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.recetas.models import (
    Receta,
    RecetaMedicamento,
    RecetaExamen,
    RecetaFormulaMagistral,
)
from app.recetas.schemas import (
    RecetaSchema,
    RecetaMedicamentoSchema,
    RecetaExamenSchema,
    RecetaFormulaMagistralSchema,
)
from app.recetas.api_v1_0 import recetas_bp
from app.historial_clinico.models import RegistroClinico
from app.medicos.models import Medico

receta_schema = RecetaSchema()
receta_schema_list = RecetaSchema(many=True)
medicamento_schema = RecetaMedicamentoSchema()
medicamento_schema_list = RecetaMedicamentoSchema(many=True)
examen_schema = RecetaExamenSchema()
examen_schema_list = RecetaExamenSchema(many=True)
formula_schema = RecetaFormulaMagistralSchema()
formula_schema_list = RecetaFormulaMagistralSchema(many=True)

api = Api(recetas_bp)


# ---------------------------------------------------------------------------
# Receta (encabezado)
# ---------------------------------------------------------------------------

class RecetaList_Resource(Resource):
    @jwt_required()
    def post(self):
        try:
            data = receta_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        if not RegistroClinico.get_by_id(data["registro_clinico_id"]):
            return {"error": "El registro clínico indicado no existe"}, 404
        if not Medico.get_by_id(data["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404

        receta = Receta(**data)
        receta.save()
        return receta_schema.dump(receta), 201


class Receta_Resource(Resource):
    @jwt_required()
    def get(self, receta_id):
        receta = Receta.get_by_id(receta_id)
        if not receta:
            return {"error": "Receta no encontrada"}, 404
        return receta_schema.dump(receta), 200

    @jwt_required()
    def put(self, receta_id):
        receta = Receta.get_by_id(receta_id)
        if not receta:
            return {"error": "Receta no encontrada"}, 404

        try:
            data = receta_schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        # El registro clínico de una receta no se reasigna por edición.
        data.pop("registro_clinico_id", None)

        if "medico_id" in data and not Medico.get_by_id(data["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404

        for key, value in data.items():
            setattr(receta, key, value)
        receta.save()
        return receta_schema.dump(receta), 200

    @jwt_required()
    def delete(self, receta_id):
        receta = Receta.get_by_id(receta_id)
        if not receta:
            return {"error": "Receta no encontrada"}, 404
        receta.delete()
        return "", 204


class RecetasPorRegistroClinico_Resource(Resource):
    @jwt_required()
    def get(self, registro_clinico_id):
        if not RegistroClinico.get_by_id(registro_clinico_id):
            return {"error": "Registro clínico no encontrado"}, 404

        recetas = (
            Receta.query
            .filter_by(registro_clinico_id=registro_clinico_id)
            .order_by(Receta.fecha.desc())
            .all()
        )
        return receta_schema_list.dump(recetas), 200


# ---------------------------------------------------------------------------
# Detalle: Medicamentos
# ---------------------------------------------------------------------------

class RecetaMedicamentoList_Resource(Resource):
    @jwt_required()
    def post(self, receta_id):
        if not Receta.get_by_id(receta_id):
            return {"error": "Receta no encontrada"}, 404

        try:
            data = medicamento_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        data["receta_id"] = receta_id
        medicamento = RecetaMedicamento(**data)
        medicamento.save()
        return medicamento_schema.dump(medicamento), 201

    @jwt_required()
    def get(self, receta_id):
        if not Receta.get_by_id(receta_id):
            return {"error": "Receta no encontrada"}, 404

        medicamentos = RecetaMedicamento.simple_filter(receta_id=receta_id)
        return medicamento_schema_list.dump(medicamentos), 200


class RecetaMedicamento_Resource(Resource):
    @jwt_required()
    def put(self, medicamento_id):
        medicamento = RecetaMedicamento.get_by_id(medicamento_id)
        if not medicamento:
            return {"error": "Medicamento no encontrado"}, 404

        try:
            data = medicamento_schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        data.pop("receta_id", None)
        for key, value in data.items():
            setattr(medicamento, key, value)
        medicamento.save()
        return medicamento_schema.dump(medicamento), 200

    @jwt_required()
    def delete(self, medicamento_id):
        medicamento = RecetaMedicamento.get_by_id(medicamento_id)
        if not medicamento:
            return {"error": "Medicamento no encontrado"}, 404
        medicamento.delete()
        return "", 204


# ---------------------------------------------------------------------------
# Detalle: Exámenes solicitados
# ---------------------------------------------------------------------------

class RecetaExamenList_Resource(Resource):
    @jwt_required()
    def post(self, receta_id):
        if not Receta.get_by_id(receta_id):
            return {"error": "Receta no encontrada"}, 404

        try:
            data = examen_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        data["receta_id"] = receta_id
        examen = RecetaExamen(**data)
        examen.save()
        return examen_schema.dump(examen), 201

    @jwt_required()
    def get(self, receta_id):
        if not Receta.get_by_id(receta_id):
            return {"error": "Receta no encontrada"}, 404

        examenes = RecetaExamen.simple_filter(receta_id=receta_id)
        return examen_schema_list.dump(examenes), 200


class RecetaExamen_Resource(Resource):
    @jwt_required()
    def put(self, examen_id):
        examen = RecetaExamen.get_by_id(examen_id)
        if not examen:
            return {"error": "Examen no encontrado"}, 404

        try:
            data = examen_schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        data.pop("receta_id", None)
        for key, value in data.items():
            setattr(examen, key, value)
        examen.save()
        return examen_schema.dump(examen), 200

    @jwt_required()
    def delete(self, examen_id):
        examen = RecetaExamen.get_by_id(examen_id)
        if not examen:
            return {"error": "Examen no encontrado"}, 404
        examen.delete()
        return "", 204


# ---------------------------------------------------------------------------
# Detalle: Fórmulas magistrales
# ---------------------------------------------------------------------------

class RecetaFormulaMagistralList_Resource(Resource):
    @jwt_required()
    def post(self, receta_id):
        if not Receta.get_by_id(receta_id):
            return {"error": "Receta no encontrada"}, 404

        try:
            data = formula_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        data["receta_id"] = receta_id
        formula = RecetaFormulaMagistral(**data)
        formula.save()
        return formula_schema.dump(formula), 201

    @jwt_required()
    def get(self, receta_id):
        if not Receta.get_by_id(receta_id):
            return {"error": "Receta no encontrada"}, 404

        formulas = RecetaFormulaMagistral.simple_filter(receta_id=receta_id)
        return formula_schema_list.dump(formulas), 200


class RecetaFormulaMagistral_Resource(Resource):
    @jwt_required()
    def put(self, formula_id):
        formula = RecetaFormulaMagistral.get_by_id(formula_id)
        if not formula:
            return {"error": "Fórmula magistral no encontrada"}, 404

        try:
            data = formula_schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        data.pop("receta_id", None)
        for key, value in data.items():
            setattr(formula, key, value)
        formula.save()
        return formula_schema.dump(formula), 200

    @jwt_required()
    def delete(self, formula_id):
        formula = RecetaFormulaMagistral.get_by_id(formula_id)
        if not formula:
            return {"error": "Fórmula magistral no encontrada"}, 404
        formula.delete()
        return "", 204


# ---------------------------------------------------------------------------
# Registro de rutas
# ---------------------------------------------------------------------------

api.add_resource(RecetaList_Resource, "/recetas")
api.add_resource(Receta_Resource, "/recetas/<int:receta_id>")
api.add_resource(RecetasPorRegistroClinico_Resource, "/recetas/registro-clinico/<int:registro_clinico_id>")

api.add_resource(RecetaMedicamentoList_Resource, "/recetas/<int:receta_id>/medicamentos")
api.add_resource(RecetaMedicamento_Resource, "/recetas/medicamentos/<int:medicamento_id>")

api.add_resource(RecetaExamenList_Resource, "/recetas/<int:receta_id>/examenes")
api.add_resource(RecetaExamen_Resource, "/recetas/examenes/<int:examen_id>")

api.add_resource(RecetaFormulaMagistralList_Resource, "/recetas/<int:receta_id>/formulas")
api.add_resource(RecetaFormulaMagistral_Resource, "/recetas/formulas/<int:formula_id>")
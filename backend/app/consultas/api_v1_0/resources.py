"""Rutas del módulo consultas."""
from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.consultas.models import Consulta
from app.consultas.schemas import ConsultaSchema
from app.consultas.api_v1_0 import consultas_bp
from app.pacientes.models import Paciente
from app.medicos.models import Medico
from app.citas.models import Cita

schema = ConsultaSchema()
schema_list = ConsultaSchema(many=True)

api = Api(consultas_bp)


class ConsultasList_Resource(Resource):
    @jwt_required()
    def get(self):
        items = Consulta.get_all()
        return schema_list.dump(items), 200

    @jwt_required()
    def post(self):
        try:
            data = schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        if not Paciente.get_by_id(data["paciente_id"]):
            return {"error": "El paciente indicado no existe"}, 404
        if not Medico.get_by_id(data["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404
        if data.get("cita_id") is not None:
            if not Cita.get_by_id(data["cita_id"]):
                return {"error": "La cita indicada no existe"}, 404
            if Consulta.simple_filter(cita_id=data["cita_id"]):
                return {"error": "Esa cita ya generó una consulta"}, 409

        item = Consulta(**data)
        item.save()
        return schema.dump(item), 201


class Consulta_Resource(Resource):
    @jwt_required()
    def get(self, item_id):
        item = Consulta.get_by_id(item_id)
        if not item:
            return {"error": "Consulta no encontrada"}, 404
        return schema.dump(item), 200

    @jwt_required()
    def put(self, item_id):
        item = Consulta.get_by_id(item_id)
        if not item:
            return {"error": "Consulta no encontrada"}, 404

        try:
            data = schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        if "paciente_id" in data and not Paciente.get_by_id(data["paciente_id"]):
            return {"error": "El paciente indicado no existe"}, 404
        if "medico_id" in data and not Medico.get_by_id(data["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404

        for key, value in data.items():
            setattr(item, key, value)
        item.save()
        return schema.dump(item), 200

    @jwt_required()
    def delete(self, item_id):
        item = Consulta.get_by_id(item_id)
        if not item:
            return {"error": "Consulta no encontrada"}, 404
        item.delete()
        return "", 204


api.add_resource(ConsultasList_Resource, "/")
api.add_resource(Consulta_Resource, "/<int:item_id>")

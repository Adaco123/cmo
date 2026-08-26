"""Rutas del módulo citas."""
from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.citas.models import Cita
from app.citas.schemas import CitaSchema
from app.citas.api_v1_0 import citas_bp
from app.pacientes.models import Paciente
from app.medicos.models import Medico
from app.estados_cita.models import EstadoCita

schema = CitaSchema()
schema_list = CitaSchema(many=True)

api = Api(citas_bp)


def _validar_referencias(data):
    if not Paciente.get_by_id(data["paciente_id"]):
        return {"error": "El paciente indicado no existe"}, 404
    if not Medico.get_by_id(data["medico_id"]):
        return {"error": "El médico indicado no existe"}, 404
    if not EstadoCita.get_by_id(data["estado_id"]):
        return {"error": "El estado de cita indicado no existe"}, 404

    return None


def _existe_choque_horario(medico_id, fecha, hora_inicio, hora_fin, excluir_id=None):
    query = Cita.query.filter(
        Cita.medico_id == medico_id,
        Cita.fecha == fecha,
        Cita.hora_inicio < hora_fin,
        Cita.hora_fin > hora_inicio,
    )
    if excluir_id is not None:
        query = query.filter(Cita.id != excluir_id)
    return query.first() is not None


class CitasList_Resource(Resource):
    @jwt_required()
    def get(self):
        items = Cita.get_all()
        return schema_list.dump(items), 200

    @jwt_required()
    def post(self):
        try:
            data = schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        error = _validar_referencias(data)
        if error:
            return error

        if _existe_choque_horario(data["medico_id"], data["fecha"], data["hora_inicio"], data["hora_fin"]):
            return {"error": "Ya existe una cita registrada con ese médico a esa misma hora"}, 409

        item = Cita(**data)
        item.save()
        return schema.dump(item), 201


class Cita_Resource(Resource):
    @jwt_required()
    def get(self, item_id):
        item = Cita.get_by_id(item_id)
        if not item:
            return {"error": "Cita no encontrada"}, 404
        return schema.dump(item), 200

    @jwt_required()
    def put(self, item_id):
        item = Cita.get_by_id(item_id)
        if not item:
            return {"error": "Cita no encontrada"}, 404

        try:
            data = schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        if "paciente_id" in data and not Paciente.get_by_id(data["paciente_id"]):
            return {"error": "El paciente indicado no existe"}, 404
        if "medico_id" in data and not Medico.get_by_id(data["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404
        if "estado_id" in data and not EstadoCita.get_by_id(data["estado_id"]):
            return {"error": "El estado de cita indicado no existe"}, 404

        hora_inicio = data.get("hora_inicio", item.hora_inicio)
        hora_fin = data.get("hora_fin", item.hora_fin)
        
        for key, value in data.items():
            setattr(item, key, value)
        item.save()
        return schema.dump(item), 200

    @jwt_required()
    def delete(self, item_id):
        item = Cita.get_by_id(item_id)
        if not item:
            return {"error": "Cita no encontrada"}, 404
        item.delete()
        return "", 204


class CitasPorMedico_Resource(Resource):
    @jwt_required()
    def get(self, medico_id):
        if not Medico.get_by_id(medico_id):
            return {"error": "Médico no encontrado"}, 404
        citas = Cita.simple_filter(medico_id=medico_id)
        return schema_list.dump(citas), 200


api.add_resource(CitasList_Resource, "/")
api.add_resource(Cita_Resource, "/<int:item_id>")
api.add_resource(CitasPorMedico_Resource, "/medico/<int:medico_id>")
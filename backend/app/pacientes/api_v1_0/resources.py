"""Rutas CRUD del módulo pacientes usando Resource."""
from flask import request
from flask_jwt_extended import jwt_required
from flask_restful import Api, Resource
from marshmallow import ValidationError

from app.pacientes.models import Paciente
from app.pacientes.schemas import PacienteSchema
from app.pacientes.api_v1_0 import pacientes_bp
from app.historial_clinico.models import HistoriaClinica
from datetime import date
schema = PacienteSchema()
schema_list = PacienteSchema(many=True)
api = Api(pacientes_bp)

class PacientesList_Resource(Resource):
    @jwt_required()
    def get(self):
        items = Paciente.get_all()
        return schema_list.dump(items), 200

    @jwt_required()
    def post(self):
        try:
            data = schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        item = Paciente(**data)
        item.save()

        historia_clinica = HistoriaClinica(paciente_id=item.id, estado=True)
        historia_clinica.save()

        return schema.dump(item), 201

class Paciente_Resource(Resource):
    @jwt_required()
    def get(self, item_id):
        item = Paciente.get_by_id(item_id)
        
        if item is None:
            return {"error": "Paciente no encontrado"}, 404
        
        return schema.dump(item), 200

    @jwt_required()
    def put(self, item_id):
        item = Paciente.get_by_id(item_id)
        if item is None:
            return {"error": "Paciente no encontrado"}, 404

        try:
            data = schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        for key, value in data.items():
            setattr(item, key, value)
        item.save()
        return schema.dump(item), 200

    @jwt_required()
    def delete(self, item_id):
        item = Paciente.get_by_id(item_id)
        if item is None:
            return {"error": "Paciente no encontrado"}, 404

        item.delete()
        return "", 204


api.add_resource(PacientesList_Resource, '/')
api.add_resource(Paciente_Resource, '/<int:item_id>')

"""Rutas CRUD del módulo origenes_paciente."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.origenes_paciente.models import OrigenPaciente
from app.origenes_paciente.schemas import OrigenPacienteSchema
from app.origenes_paciente.api_v1_0 import origenes_paciente_bp

schema = OrigenPacienteSchema()
schema_list = OrigenPacienteSchema(many=True)


@origenes_paciente_bp.route("/", methods=["GET"])
@jwt_required()
def listar_origenes_paciente():
    items = OrigenPaciente.get_all()
    return jsonify(schema_list.dump(items)), 200


@origenes_paciente_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_origenes_paciente(item_id):
    item = OrigenPaciente.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "OrigenPaciente no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@origenes_paciente_bp.route("/", methods=["POST"])
@jwt_required()
def crear_origenes_paciente():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = OrigenPaciente(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@origenes_paciente_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_origenes_paciente(item_id):
    item = OrigenPaciente.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "OrigenPaciente no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@origenes_paciente_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_origenes_paciente(item_id):
    item = OrigenPaciente.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "OrigenPaciente no encontrado"}), 404

    item.delete()
    return "", 204

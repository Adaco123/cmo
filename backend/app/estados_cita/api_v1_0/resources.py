"""Rutas CRUD del módulo estados_cita."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.estados_cita.models import EstadoCita
from app.estados_cita.schemas import EstadoCitaSchema
from app.estados_cita.api_v1_0 import estados_cita_bp

schema = EstadoCitaSchema()
schema_list = EstadoCitaSchema(many=True)


@estados_cita_bp.route("/", methods=["GET"])
@jwt_required()
def listar_estados_cita():
    items = EstadoCita.get_all()
    return jsonify(schema_list.dump(items)), 200


@estados_cita_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_estados_cita(item_id):
    item = EstadoCita.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCita no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@estados_cita_bp.route("/", methods=["POST"])
@jwt_required()
def crear_estados_cita():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = EstadoCita(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@estados_cita_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_estados_cita(item_id):
    item = EstadoCita.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCita no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@estados_cita_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_estados_cita(item_id):
    item = EstadoCita.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCita no encontrado"}), 404

    item.delete()
    return "", 204

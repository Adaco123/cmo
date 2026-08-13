"""Rutas CRUD del módulo estados_cobro."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.estados_cobro.models import EstadoCobro
from app.estados_cobro.schemas import EstadoCobroSchema
from app.estados_cobro.api_v1_0 import estados_cobro_bp

schema = EstadoCobroSchema()
schema_list = EstadoCobroSchema(many=True)


@estados_cobro_bp.route("/", methods=["GET"])
@jwt_required()
def listar_estados_cobro():
    items = EstadoCobro.get_all()
    return jsonify(schema_list.dump(items)), 200


@estados_cobro_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_estados_cobro(item_id):
    item = EstadoCobro.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCobro no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@estados_cobro_bp.route("/", methods=["POST"])
@jwt_required()
def crear_estados_cobro():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = EstadoCobro(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@estados_cobro_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_estados_cobro(item_id):
    item = EstadoCobro.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCobro no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@estados_cobro_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_estados_cobro(item_id):
    item = EstadoCobro.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCobro no encontrado"}), 404

    item.delete()
    return "", 204

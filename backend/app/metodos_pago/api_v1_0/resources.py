"""Rutas CRUD del módulo metodos_pago."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.metodos_pago.models import MetodoPago
from app.metodos_pago.schemas import MetodoPagoSchema
from app.metodos_pago.api_v1_0 import metodos_pago_bp

schema = MetodoPagoSchema()
schema_list = MetodoPagoSchema(many=True)


@metodos_pago_bp.route("/", methods=["GET"])
@jwt_required()
def listar_metodos_pago():
    items = MetodoPago.get_all()
    return jsonify(schema_list.dump(items)), 200


@metodos_pago_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_metodos_pago(item_id):
    item = MetodoPago.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "MetodoPago no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@metodos_pago_bp.route("/", methods=["POST"])
@jwt_required()
def crear_metodos_pago():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = MetodoPago(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@metodos_pago_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_metodos_pago(item_id):
    item = MetodoPago.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "MetodoPago no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@metodos_pago_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_metodos_pago(item_id):
    item = MetodoPago.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "MetodoPago no encontrado"}), 404

    item.delete()
    return "", 204

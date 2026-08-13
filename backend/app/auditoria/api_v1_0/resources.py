"""Rutas CRUD del módulo auditoria."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.auditoria.models import Auditoria
from app.auditoria.schemas import AuditoriaSchema
from app.auditoria.api_v1_0 import auditoria_bp

schema = AuditoriaSchema()
schema_list = AuditoriaSchema(many=True)


@auditoria_bp.route("/", methods=["GET"])
@jwt_required()
def listar_auditoria():
    items = Auditoria.get_all()
    return jsonify(schema_list.dump(items)), 200


@auditoria_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_auditoria(item_id):
    item = Auditoria.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Auditoria no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@auditoria_bp.route("/", methods=["POST"])
@jwt_required()
def crear_auditoria():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Auditoria(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@auditoria_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_auditoria(item_id):
    item = Auditoria.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Auditoria no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@auditoria_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_auditoria(item_id):
    item = Auditoria.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Auditoria no encontrado"}), 404

    item.delete()
    return "", 204

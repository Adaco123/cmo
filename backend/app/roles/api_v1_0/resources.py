"""Rutas CRUD del módulo roles."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.roles.models import Rol
from app.roles.schemas import RolSchema
from app.roles.api_v1_0 import roles_bp

schema = RolSchema()
schema_list = RolSchema(many=True)


@roles_bp.route("/", methods=["GET"])
@jwt_required()
def listar_roles():
    items = Rol.get_all()
    return jsonify(schema_list.dump(items)), 200


@roles_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_roles(item_id):
    item = Rol.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Rol no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@roles_bp.route("/", methods=["POST"])
@jwt_required()
def crear_roles():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Rol(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@roles_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_roles(item_id):
    item = Rol.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Rol no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@roles_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_roles(item_id):
    item = Rol.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Rol no encontrado"}), 404

    item.delete()
    return "", 204

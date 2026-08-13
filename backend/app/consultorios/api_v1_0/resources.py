"""Rutas CRUD del módulo consultorios."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.consultorios.models import Consultorio
from app.consultorios.schemas import ConsultorioSchema
from app.consultorios.api_v1_0 import consultorios_bp

schema = ConsultorioSchema()
schema_list = ConsultorioSchema(many=True)


@consultorios_bp.route("/", methods=["GET"])
@jwt_required()
def listar_consultorios():
    items = Consultorio.get_all()
    return jsonify(schema_list.dump(items)), 200


@consultorios_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_consultorios(item_id):
    item = Consultorio.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Consultorio no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@consultorios_bp.route("/", methods=["POST"])
@jwt_required()
def crear_consultorios():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Consultorio(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@consultorios_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_consultorios(item_id):
    item = Consultorio.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Consultorio no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@consultorios_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_consultorios(item_id):
    item = Consultorio.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Consultorio no encontrado"}), 404

    item.delete()
    return "", 204

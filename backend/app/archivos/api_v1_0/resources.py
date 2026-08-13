"""Rutas CRUD del módulo archivos."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.archivos.models import Archivo
from app.archivos.schemas import ArchivoSchema
from app.archivos.api_v1_0 import archivos_bp

schema = ArchivoSchema()
schema_list = ArchivoSchema(many=True)


@archivos_bp.route("/", methods=["GET"])
@jwt_required()
def listar_archivos():
    items = Archivo.get_all()
    return jsonify(schema_list.dump(items)), 200


@archivos_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_archivos(item_id):
    item = Archivo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Archivo no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@archivos_bp.route("/", methods=["POST"])
@jwt_required()
def crear_archivos():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Archivo(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@archivos_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_archivos(item_id):
    item = Archivo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Archivo no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@archivos_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_archivos(item_id):
    item = Archivo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Archivo no encontrado"}), 404

    item.delete()
    return "", 204

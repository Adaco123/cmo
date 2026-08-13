"""Rutas CRUD del módulo tipos_archivo."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.tipos_archivo.models import TipoArchivo
from app.tipos_archivo.schemas import TipoArchivoSchema
from app.tipos_archivo.api_v1_0 import tipos_archivo_bp

schema = TipoArchivoSchema()
schema_list = TipoArchivoSchema(many=True)


@tipos_archivo_bp.route("/", methods=["GET"])
@jwt_required()
def listar_tipos_archivo():
    items = TipoArchivo.get_all()
    return jsonify(schema_list.dump(items)), 200


@tipos_archivo_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_tipos_archivo(item_id):
    item = TipoArchivo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "TipoArchivo no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@tipos_archivo_bp.route("/", methods=["POST"])
@jwt_required()
def crear_tipos_archivo():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = TipoArchivo(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@tipos_archivo_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_tipos_archivo(item_id):
    item = TipoArchivo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "TipoArchivo no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@tipos_archivo_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_tipos_archivo(item_id):
    item = TipoArchivo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "TipoArchivo no encontrado"}), 404

    item.delete()
    return "", 204

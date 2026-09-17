"""Rutas CRUD del módulo categorias_modelo."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.categorias_modelo.models import CategoriaModelo
from app.categorias_modelo.schemas import CategoriaModeloSchema
from app.categorias_modelo.api_v1_0 import categorias_modelo_bp
from app.modelos_informe.models import ModeloInforme

schema = CategoriaModeloSchema()
schema_list = CategoriaModeloSchema(many=True)


@categorias_modelo_bp.route("/", methods=["GET"])
@jwt_required()
def listar_categorias_modelo():
    items = CategoriaModelo.get_all()
    return jsonify(schema_list.dump(items)), 200


@categorias_modelo_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_categorias_modelo(item_id):
    item = CategoriaModelo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "CategoriaModelo no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@categorias_modelo_bp.route("/", methods=["POST"])
@jwt_required()
def crear_categorias_modelo():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = CategoriaModelo(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@categorias_modelo_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_categorias_modelo(item_id):
    item = CategoriaModelo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "CategoriaModelo no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@categorias_modelo_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_categorias_modelo(item_id):
    item = CategoriaModelo.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "CategoriaModelo no encontrado"}), 404

    if ModeloInforme.simple_filter(categoria_id=item.id):
        return jsonify({
            "error": "Esta categoría tiene plantillas asociadas y no se puede eliminar"
        }), 409

    item.delete()
    return "", 204
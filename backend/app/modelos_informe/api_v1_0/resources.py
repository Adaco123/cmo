"""Rutas CRUD del módulo modelos_informe."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.modelos_informe.models import ModeloInforme
from app.modelos_informe.schemas import ModeloInformeSchema
from app.modelos_informe.api_v1_0 import modelos_informe_bp
from app.informes_ecografia.models import InformeEcografia
from app.categorias_modelo.models import CategoriaModelo

schema = ModeloInformeSchema()
schema_list = ModeloInformeSchema(many=True)


@modelos_informe_bp.route("/", methods=["GET"])
@jwt_required()
def listar_modelos_informe():
    items = ModeloInforme.get_all()
    return jsonify(schema_list.dump(items)), 200


@modelos_informe_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_modelos_informe(item_id):
    item = ModeloInforme.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "ModeloInforme no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@modelos_informe_bp.route("/", methods=["POST"])
@jwt_required()
def crear_modelos_informe():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    if "categoria_id" in data and not CategoriaModelo.get_by_id(data["categoria_id"]):
        return jsonify({"error": "categoria_id no existe"}), 404

    item = ModeloInforme(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@modelos_informe_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_modelos_informe(item_id):
    item = ModeloInforme.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "ModeloInforme no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    if "categoria_id" in data and not CategoriaModelo.get_by_id(data["categoria_id"]):
        return jsonify({"error": "categoria_id no existe"}), 404

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@modelos_informe_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_modelos_informe(item_id):
    item = ModeloInforme.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "ModeloInforme no encontrado"}), 404

    if InformeEcografia.simple_filter(modelo_id=item.id):
        return jsonify({
            "error": "Esta plantilla ya generó informes y no se puede eliminar"
        }), 409

    item.delete()
    return "", 204
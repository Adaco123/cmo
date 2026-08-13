"""Rutas CRUD del módulo informes_ecografia."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.informes_ecografia.models import InformeEcografia
from app.informes_ecografia.schemas import InformeEcografiaSchema
from app.informes_ecografia.api_v1_0 import informes_ecografia_bp

schema = InformeEcografiaSchema()
schema_list = InformeEcografiaSchema(many=True)


@informes_ecografia_bp.route("/", methods=["GET"])
@jwt_required()
def listar_informes_ecografia():
    items = InformeEcografia.get_all()
    return jsonify(schema_list.dump(items)), 200


@informes_ecografia_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_informes_ecografia(item_id):
    item = InformeEcografia.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "InformeEcografia no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@informes_ecografia_bp.route("/", methods=["POST"])
@jwt_required()
def crear_informes_ecografia():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = InformeEcografia(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@informes_ecografia_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_informes_ecografia(item_id):
    item = InformeEcografia.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "InformeEcografia no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@informes_ecografia_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_informes_ecografia(item_id):
    item = InformeEcografia.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "InformeEcografia no encontrado"}), 404

    item.delete()
    return "", 204

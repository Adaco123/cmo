"""Rutas CRUD del módulo empleados."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.empleados.models import Empleado
from app.empleados.schemas import EmpleadoSchema
from app.empleados.api_v1_0 import empleados_bp

schema = EmpleadoSchema()
schema_list = EmpleadoSchema(many=True)


@empleados_bp.route("/", methods=["GET"])
@jwt_required()
def listar_empleados():
    items = Empleado.get_all()
    return jsonify(schema_list.dump(items)), 200


@empleados_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_empleados(item_id):
    item = Empleado.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Empleado no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@empleados_bp.route("/", methods=["POST"])
@jwt_required()
def crear_empleados():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Empleado(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@empleados_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_empleados(item_id):
    item = Empleado.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Empleado no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@empleados_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_empleados(item_id):
    item = Empleado.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Empleado no encontrado"}), 404

    item.delete()
    return "", 204

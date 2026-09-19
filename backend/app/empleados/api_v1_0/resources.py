"""Rutas CRUD del módulo empleados."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.empleados.models import Empleado
from app.empleados.schemas import EmpleadoSchema
from app.empleados.api_v1_0 import empleados_bp
from app.medicos.models import Medico
from app.usuarios.models import Usuario
from app.consultorios.models import Consultorio


def _error_fk_inexistente(data):
    if "usuario_id" in data and not Usuario.get_by_id(data["usuario_id"]):
        return "usuario_id no existe"
    if data.get("consultorio_id") is not None and not Consultorio.get_by_id(data["consultorio_id"]):
        return "consultorio_id no existe"
    return None

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

    error_fk = _error_fk_inexistente(data)
    if error_fk:
        return jsonify({"error": error_fk}), 404

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

    error_fk = _error_fk_inexistente(data)
    if error_fk:
        return jsonify({"error": error_fk}), 404

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

    if Medico.simple_filter(empleado_id=item.id):
        return jsonify({
            "error": "Este empleado tiene una ficha de médico asociada y no se puede eliminar"
        }), 409

    item.delete()
    return "", 204
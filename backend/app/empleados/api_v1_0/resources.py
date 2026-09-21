from flask import jsonify
from flask_jwt_extended import jwt_required

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
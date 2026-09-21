"""Rutas CRUD del módulo consultorios."""
from flask import request, jsonify
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.db import db
from app.shared.permisos import admin_required
from app.consultorios.models import Consultorio
from app.consultorios.schemas import ConsultorioSchema
from app.consultorios.api_v1_0 import consultorios_bp
from app.empleados.models import Empleado
from app.pacientes.models import Paciente
from app.citas.models import Cita

schema = ConsultorioSchema()
schema_list = ConsultorioSchema(many=True)
api = Api(consultorios_bp)

_DEPENDENCIAS_CONSULTORIO = [
    (Empleado, "consultorio_id", "empleados asignados"),
    (Paciente, "consultorio_id", "pacientes asignados"),
    (Cita, "consultorio_id", "citas registradas"),
]


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


class ConsultorioCrear_Resource(Resource):
    """POST /api/consultorios/ — solo Administrador.

    Reemplaza al POST anterior, que solo pedía un JWT válido: cualquier
    usuario logueado podía crear consultorios.
    """

    @jwt_required()
    @admin_required
    def post(self):
        body = request.get_json(force=True) or {}
        if not isinstance(body, dict):
            return {"error": "El cuerpo debe ser un objeto JSON"}, 400

        # Sin espacios en los bordes; un texto vacío pasa a None para que
        # el schema rechace el nombre y deje vacíos los campos opcionales.
        body = {
            clave: (valor.strip() or None) if isinstance(valor, str) else valor
            for clave, valor in body.items()
        }

        try:
            data = schema.load(body)
        except ValidationError as err:
            return err.messages, 400

        repetido = Consultorio.query.filter(
            db.func.lower(Consultorio.nombre) == data["nombre"].lower()
        ).first()
        if repetido:
            return {"error": f"Ya existe un consultorio llamado {repetido.nombre}"}, 409

        item = Consultorio(**data)
        item.save()
        return schema.dump(item), 201


api.add_resource(ConsultorioCrear_Resource, "/")


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

    for Modelo, campo, descripcion in _DEPENDENCIAS_CONSULTORIO:
        if Modelo.simple_filter(**{campo: item.id}):
            return jsonify({
                "error": f"Este consultorio tiene {descripcion} y no se puede eliminar"
            }), 409

    item.delete()
    return "", 204
"""Rutas CRUD del módulo medicos."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.medicos.models import Medico
from app.medicos.schemas import MedicoSchema
from app.medicos.api_v1_0 import medicos_bp
from app.citas.models import Cita
from app.consultas.models import Consulta
from app.recetas.models import Receta
from app.historial_clinico.models import SeguimientoControl
from app.informes_ecografia.models import InformeEcografia

schema = MedicoSchema()
schema_list = MedicoSchema(many=True)

# Mismo patrón que en los catálogos (metodos_pago, roles, etc.): antes de
# borrar, chequear cada FK real que apunta a medicos.id (todas nullable=False
# y sin ondelete='SET NULL', así que una fila que las use bloquea el DELETE
# a nivel de base de datos con un IntegrityError sin capturar).
_DEPENDENCIAS_MEDICO = [
    (Cita, "medico_id", "citas registradas"),
    (Consulta, "medico_id", "consultas registradas"),
    (Receta, "medico_id", "recetas registradas"),
    (SeguimientoControl, "medico_id", "seguimientos de control registrados"),
    (InformeEcografia, "medico_id", "informes de ecografía registrados"),
]


@medicos_bp.route("/", methods=["GET"])
@jwt_required()
def listar_medicos():
    items = Medico.get_all()
    return jsonify(schema_list.dump(items)), 200


@medicos_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_medicos(item_id):
    item = Medico.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Medico no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@medicos_bp.route("/", methods=["POST"])
@jwt_required()
def crear_medicos():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Medico(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@medicos_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_medicos(item_id):
    item = Medico.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Medico no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@medicos_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_medicos(item_id):
    item = Medico.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Medico no encontrado"}), 404

    for Modelo, campo, descripcion in _DEPENDENCIAS_MEDICO:
        if Modelo.simple_filter(**{campo: item.id}):
            return jsonify({
                "error": f"Este médico tiene {descripcion} y no se puede eliminar"
            }), 409

    item.delete()
    return "", 204
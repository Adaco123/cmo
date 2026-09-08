"""Rutas CRUD del módulo estados_cita."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.db import db
from app.estados_cita.models import EstadoCita
from app.estados_cita.schemas import EstadoCitaSchema
from app.estados_cita.api_v1_0 import estados_cita_bp

schema = EstadoCitaSchema()
schema_list = EstadoCitaSchema(many=True)

# Mismo patrón de auto-creación perezosa que _get_or_create_categoria_examen
# en historial_clinico: garantiza que existan estos 4 nombres, en este
# orden, la primera vez que alguien consulta el catálogo — para que el
# selector de estado en el frontend siempre tenga opciones aunque sea una
# base de datos nueva. Si un nombre ya existe (por id que sea), no se
# vuelve a crear ni se reasigna: esto nunca toca ids ya existentes.
#
# "Atendida" se agregó porque el botón "Finalizar" del dashboard (marcar
# que el médico ya atendió al paciente) estaba usando por error
# estado_id=2 hardcodeado en el frontend, que en la práctica apuntaba a
# "Cancelada" — o sea, "Finalizar" cancelaba la cita en vez de marcarla
# como atendida. Con este estado nuevo, el frontend busca "Atendida" por
# nombre (nunca por id) sobre este mismo catálogo.
ESTADOS_CITA_POR_DEFECTO = ["Programada", "Cancelada", "No asistió", "Atendida"]


def _asegurar_estados_cita_por_defecto():
    hay_nuevos = False
    for nombre in ESTADOS_CITA_POR_DEFECTO:
        if not EstadoCita.query.filter_by(nombre=nombre).first():
            db.session.add(EstadoCita(nombre=nombre))
            hay_nuevos = True
    if hay_nuevos:
        db.session.commit()


@estados_cita_bp.route("/", methods=["GET"])
@jwt_required()
def listar_estados_cita():
    _asegurar_estados_cita_por_defecto()
    items = EstadoCita.get_all()
    return jsonify(schema_list.dump(items)), 200


@estados_cita_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_estados_cita(item_id):
    item = EstadoCita.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCita no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@estados_cita_bp.route("/", methods=["POST"])
@jwt_required()
def crear_estados_cita():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = EstadoCita(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@estados_cita_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_estados_cita(item_id):
    item = EstadoCita.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCita no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@estados_cita_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_estados_cita(item_id):
    item = EstadoCita.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCita no encontrado"}), 404

    item.delete()
    return "", 204
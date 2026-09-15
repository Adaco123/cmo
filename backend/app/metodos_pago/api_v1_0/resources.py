"""Rutas CRUD del módulo metodos_pago."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.db import db
from app.metodos_pago.models import MetodoPago
from app.metodos_pago.schemas import MetodoPagoSchema
from app.metodos_pago.api_v1_0 import metodos_pago_bp

schema = MetodoPagoSchema()
schema_list = MetodoPagoSchema(many=True)

# Mismo patrón de auto-creación perezosa que ESTADOS_CITA_POR_DEFECTO en
# estados_cita: garantiza que existan estos 2 nombres, en este orden, la
# primera vez que alguien consulta el catálogo — para que una base de
# datos nueva (Docker, PC nueva, etc.) tenga los mismos ids que espera el
# frontend. Si un nombre ya existe, no se vuelve a crear ni se reasigna:
# esto nunca toca ids ya existentes.
#
# El orden es obligatorio: Cobrar.tsx tiene METODO_PAGO_IDS hardcodeado
# como { Efectivo: 1, QR: 2 }, así que "Efectivo" debe quedar con id=1 y
# "QR" con id=2.
METODOS_PAGO_POR_DEFECTO = ["Efectivo", "QR"]


def _asegurar_metodos_pago_por_defecto():
    hay_nuevos = False
    for nombre in METODOS_PAGO_POR_DEFECTO:
        if not MetodoPago.query.filter_by(nombre=nombre).first():
            db.session.add(MetodoPago(nombre=nombre))
            hay_nuevos = True
    if hay_nuevos:
        db.session.commit()


@metodos_pago_bp.route("/", methods=["GET"])
@jwt_required()
def listar_metodos_pago():
    _asegurar_metodos_pago_por_defecto()
    items = MetodoPago.get_all()
    return jsonify(schema_list.dump(items)), 200


@metodos_pago_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_metodos_pago(item_id):
    item = MetodoPago.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "MetodoPago no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@metodos_pago_bp.route("/", methods=["POST"])
@jwt_required()
def crear_metodos_pago():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = MetodoPago(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@metodos_pago_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_metodos_pago(item_id):
    item = MetodoPago.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "MetodoPago no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@metodos_pago_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_metodos_pago(item_id):
    item = MetodoPago.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "MetodoPago no encontrado"}), 404

    item.delete()
    return "", 204

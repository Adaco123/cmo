"""Rutas CRUD del módulo estados_cobro."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.db import db
from app.estados_cobro.models import EstadoCobro
from app.estados_cobro.schemas import EstadoCobroSchema
from app.estados_cobro.api_v1_0 import estados_cobro_bp

schema = EstadoCobroSchema()
schema_list = EstadoCobroSchema(many=True)

# Mismo patrón de auto-creación perezosa que ESTADOS_CITA_POR_DEFECTO en
# estados_cita. El orden es obligatorio y crítico: pagos/api_v1_0/resources.py
# tiene ESTADO_PAGADO_ID = 1 hardcodeado (usado en _estado_pagado()), y
# tanto pagos como cobros buscan "Pendiente" por nombre. Si "Pagado" no
# queda con id=1 en una base de datos nueva, _recalcular_estado_cobro()
# no podrá marcar ningún cobro como pagado.
ESTADOS_COBRO_POR_DEFECTO = ["Pagado", "Pendiente"]


def _asegurar_estados_cobro_por_defecto():
    hay_nuevos = False
    for nombre in ESTADOS_COBRO_POR_DEFECTO:
        if not EstadoCobro.query.filter_by(nombre=nombre).first():
            db.session.add(EstadoCobro(nombre=nombre))
            hay_nuevos = True
    if hay_nuevos:
        db.session.commit()


@estados_cobro_bp.route("/", methods=["GET"])
@jwt_required()
def listar_estados_cobro():
    _asegurar_estados_cobro_por_defecto()
    items = EstadoCobro.get_all()
    return jsonify(schema_list.dump(items)), 200


@estados_cobro_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_estados_cobro(item_id):
    item = EstadoCobro.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCobro no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@estados_cobro_bp.route("/", methods=["POST"])
@jwt_required()
def crear_estados_cobro():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = EstadoCobro(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@estados_cobro_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_estados_cobro(item_id):
    item = EstadoCobro.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCobro no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@estados_cobro_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_estados_cobro(item_id):
    item = EstadoCobro.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "EstadoCobro no encontrado"}), 404

    item.delete()
    return "", 204

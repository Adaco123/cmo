"""Rutas CRUD del módulo roles."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.db import db
from app.roles.models import Rol
from app.roles.schemas import RolSchema
from app.roles.api_v1_0 import roles_bp

schema = RolSchema()
schema_list = RolSchema(many=True)

# Mismo patrón de auto-creación perezosa que ESTADOS_CITA_POR_DEFECTO en
# estados_cita. Aquí el id no importa (usuarios/api_v1_0/resources.py
# busca por nombre: ROLES_ADMIN = {"Propietario", "Administrador"}), pero
# si estos dos nombres no existen en una base de datos nueva, es_admin()
# nunca podrá reconocer a nadie como administrador. Los demás roles
# (Médico, Recepcionista, etc.) los sigues creando a mano desde este
# mismo CRUD, sin problema, porque nada en el código depende de sus
# nombres exactos.
ROLES_POR_DEFECTO = ["Propietario", "Administrador"]


def _asegurar_roles_por_defecto():
    hay_nuevos = False
    for nombre in ROLES_POR_DEFECTO:
        if not Rol.query.filter_by(nombre=nombre).first():
            db.session.add(Rol(nombre=nombre))
            hay_nuevos = True
    if hay_nuevos:
        db.session.commit()


@roles_bp.route("/", methods=["GET"])
@jwt_required()
def listar_roles():
    _asegurar_roles_por_defecto()
    items = Rol.get_all()
    return jsonify(schema_list.dump(items)), 200


@roles_bp.route("/<int:item_id>", methods=["GET"])
@jwt_required()
def obtener_roles(item_id):
    item = Rol.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Rol no encontrado"}), 404
    return jsonify(schema.dump(item)), 200


@roles_bp.route("/", methods=["POST"])
@jwt_required()
def crear_roles():
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify(err.messages), 400

    item = Rol(**data)
    item.save()
    return jsonify(schema.dump(item)), 201


@roles_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def actualizar_roles(item_id):
    item = Rol.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Rol no encontrado"}), 404

    try:
        data = schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in data.items():
        setattr(item, key, value)
    item.save()
    return jsonify(schema.dump(item)), 200


@roles_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def eliminar_roles(item_id):
    item = Rol.get_by_id(item_id)
    if item is None:
        return jsonify({"error": "Rol no encontrado"}), 404

    item.delete()
    return "", 204

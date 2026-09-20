"""Rutas del módulo roles (solo lectura).

El sistema tiene solo dos roles, Administrador y Médico, y son un catálogo
fijo: se crean desde el código (ver ROLES_POR_DEFECTO) y no se crean, editan
ni borran desde la API. Antes POST/PUT/DELETE solo pedían un JWT válido, y
como es_admin() (shared/permisos.py) reconoce al administrador por el NOMBRE del rol, cualquier
usuario logueado podía renombrar "Administrador" y dejar a todos sin permisos.
"""
import unicodedata

from flask import jsonify
from flask_jwt_extended import jwt_required

from app.db import db
from app.roles.models import Rol
from app.roles.schemas import RolSchema
from app.roles.api_v1_0 import roles_bp

schema = RolSchema()
schema_list = RolSchema(many=True)

ROLES_POR_DEFECTO = ["Administrador", "Médico"]


def _normalizar(nombre):
    """'Médico', 'medico' y 'MEDICO' cuentan como el mismo rol (sin tildes ni mayúsculas)."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre) if unicodedata.category(c) != "Mn"
    )
    return sin_tildes.strip().lower()


def _asegurar_roles_por_defecto():

    existentes = {_normalizar(r.nombre) for r in Rol.query.all()}
    hay_nuevos = False
    for nombre in ROLES_POR_DEFECTO:
        if _normalizar(nombre) not in existentes:
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
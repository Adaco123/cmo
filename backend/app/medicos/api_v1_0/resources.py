import re

from flask import request, jsonify, current_app
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from app.db import db
from app.medicos.models import Medico
from app.medicos.schemas import MedicoSchema
from app.medicos.api_v1_0 import medicos_bp
from app.empleados.models import Empleado
from app.empleados.schemas import EmpleadoSchema
from app.usuarios.models import Usuario
from app.usuarios.schemas import UsuarioSchema
from app.shared.permisos import admin_required
from app.roles.models import Rol
from app.consultorios.models import Consultorio
from app.citas.models import Cita
from app.consultas.models import Consulta
from app.recetas.models import Receta
from app.historial_clinico.models import SeguimientoControl
from app.informes_ecografia.models import InformeEcografia

schema = MedicoSchema()
schema_list = MedicoSchema(many=True)
usuario_schema = UsuarioSchema()
empleado_schema = EmpleadoSchema()
medico_schema = MedicoSchema()

api = Api(medicos_bp)

_USUARIO_REGEX = r'^[A-Za-z0-9_.]{3,50}$'

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


def _limpiar_bloque(bloque):
    if not isinstance(bloque, dict):
        return {}
    limpio = {}
    for clave, valor in bloque.items():
        if isinstance(valor, str) and clave != "contra":
            valor = valor.strip() or None
        limpio[clave] = valor
    return limpio


class MedicoAltaCompleta_Resource(Resource):
    @jwt_required()
    @admin_required
    def post(self):
        body = request.get_json(force=True) or {}
        if not isinstance(body, dict):
            return {"error": "El cuerpo debe ser un objeto JSON"}, 400

        usuario_data = _limpiar_bloque(body.get("usuario"))
        empleado_data = _limpiar_bloque(body.get("empleado"))
        medico_data = _limpiar_bloque(body.get("medico"))

        contra = usuario_data.pop("contra", None)

        try:
            usuario_validated = usuario_schema.load(
                usuario_data, partial=("contrasena_hash",)
            )
        except ValidationError as err:
            return {"usuario": err.messages}, 400

        try:
            empleado_validated = empleado_schema.load(
                empleado_data, partial=("usuario_id",)
            )
        except ValidationError as err:
            return {"empleado": err.messages}, 400

        try:
            medico_validated = medico_schema.load(
                medico_data, partial=("empleado_id",)
            )
        except ValidationError as err:
            return {"medico": err.messages}, 400

        if not isinstance(contra, str) or not contra.strip():
            return {"usuario": {"contra": ["Requerido"]}}, 400
        if len(contra) < 8:
            return {"usuario": {"contra": ["Debe tener al menos 8 caracteres"]}}, 400
        if not re.match(_USUARIO_REGEX, usuario_validated["usuario"]):
            return {"usuario": {"usuario": [
                "Debe tener entre 3 y 50 caracteres alfanuméricos"
            ]}}, 400

        rol = Rol.get_by_id(usuario_validated["rol_id"])
        if not rol:
            return {"error": "El rol indicado no existe"}, 404

        consultorio_id = empleado_validated.get("consultorio_id")
        if consultorio_id is not None and not Consultorio.get_by_id(consultorio_id):
            return {"error": "El consultorio indicado no existe"}, 404

        if Usuario.get_by_usuario(usuario_validated["usuario"]):
            return {"error": f"El usuario {usuario_validated['usuario']} ya existe"}, 409
        if Usuario.get_by_correo(usuario_validated["correo"]):
            return {"error": f"El correo {usuario_validated['correo']} ya está siendo utilizado por otro usuario"}, 409
        if Empleado.simple_filter(documento=empleado_validated["documento"]):
            return {"error": f"Ya existe un empleado con el documento {empleado_validated['documento']}"}, 409
        if Medico.simple_filter(matricula_profesional=medico_validated["matricula_profesional"]):
            return {"error": f"La matrícula {medico_validated['matricula_profesional']} ya está registrada"}, 409

        try:
            usuario_validated.pop("contrasena_hash", None)
            usuario = Usuario(**usuario_validated)
            usuario.set_password(contra)
            db.session.add(usuario)
            db.session.flush()

            empleado_validated["usuario_id"] = usuario.id
            empleado = Empleado(**empleado_validated)
            db.session.add(empleado)
            db.session.flush()

            medico_validated["empleado_id"] = empleado.id
            medico = Medico(**medico_validated)
            db.session.add(medico)

            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return {
                "error": "Alguno de los datos únicos (usuario, correo, documento o matrícula) ya está en uso"
            }, 409
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Error guardando el alta completa del médico")
            return {"error": "No se pudo guardar el alta completa del médico"}, 500

        return {
            "usuario": usuario_schema.dump(usuario),
            "empleado": empleado_schema.dump(empleado),
            "medico": medico_schema.dump(medico),
        }, 201


api.add_resource(MedicoAltaCompleta_Resource, "/alta-completa")
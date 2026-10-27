"""Rutas del módulo examenes_complementarios."""
import os

from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from app.db import db
from app.examenes_complementarios.models import CategoriaExamen, ExamenComplementario
from app.examenes_complementarios.schemas import CategoriaExamenSchema, ExamenComplementarioSchema
from app.examenes_complementarios.api_v1_0 import examenes_complementarios_bp
from app.archivos.storage import get_upload_dir
from app.consultas.models import Consulta
from app.pacientes.models import Paciente

categoria_schema_list = CategoriaExamenSchema(many=True)
examen_schema = ExamenComplementarioSchema()

api = Api(examenes_complementarios_bp)


class CategoriaExamenList_Resource(Resource):
    """Catálogo de categorías de examen (laboratorio, imagenología, etc.),
    usado tanto por Receta.tsx (al solicitar un examen) como por
    Examenes.tsx (al registrar uno que el paciente trae directo)."""

    @jwt_required()
    def get(self):
        categorias = CategoriaExamen.get_all()
        return categoria_schema_list.dump(categorias), 200


class ExamenesConsultasPaciente_Resource(Resource):
    """GET /api/examenes/paciente/<id>/consultas

    Exámenes de un paciente que cuelgan directamente de una consulta (las
    atenciones sin registro clínico, p. ej. las de "Subir archivos")."""

    @jwt_required()
    def get(self, paciente_id):
        if not Paciente.get_by_id(paciente_id):
            return {"error": "Paciente no encontrado"}, 404

        examenes = (
            ExamenComplementario.query
            .join(Consulta, Consulta.id == ExamenComplementario.consulta_id)
            .filter(Consulta.paciente_id == paciente_id, ExamenComplementario.estado.is_(True))
            .order_by(ExamenComplementario.created_at.desc())
            .all()
        )
        return ExamenComplementarioSchema(many=True).dump(examenes), 200


class ExamenComplementarioObservaciones_Resource(Resource):
    """Completa/edita la observación de un examen ya existente: el caso
    típico es el espejo 'Pendiente' creado junto con una solicitud, cuando
    el paciente vuelve con el resultado (la foto/documento se sube aparte,
    por el flujo de archivos que ya existe)."""

    @jwt_required()
    def put(self, examen_id):
        examen = ExamenComplementario.get_by_id(examen_id)
        if not examen:
            return {"error": "El examen complementario indicado no existe"}, 404

        body = request.get_json(force=True) or {}
        observaciones = (body.get("observaciones") or "").strip()
        if len(observaciones) > 300:
            return {"observaciones": ["No puede superar los 300 caracteres"]}, 400

        examen.observaciones = observaciones or None
        examen.save()
        return examen_schema.dump(examen), 200


class ExamenComplementario_Resource(Resource):
    """DELETE /api/examenes/<int:examen_id>

    Antes esta ruta no existía aunque el frontend (deleteExamenComplementario
    en api/examenesComplementarios.ts) ya la llamaba — daba 404. Se agrega
    acá. ExamenComplementario.archivos tiene cascade="all, delete-orphan",
    así que SQLAlchemy borra solo las filas de Archivo asociadas; hay que
    borrar los archivos físicos en disco ANTES de que eso pase (si se hace
    después, ya no queda cómo encontrar su ruta_almacenamiento). Nada más
    referencia examenes_complementarios.id, así que no hace falta chequeo
    de dependencias adicional.
    """

    @jwt_required()
    def delete(self, examen_id):
        examen = ExamenComplementario.get_by_id(examen_id)
        if not examen:
            return {"error": "El examen complementario indicado no existe"}, 404

        for archivo in list(examen.archivos):
            ruta_en_disco = os.path.join(get_upload_dir(), archivo.ruta_almacenamiento)
            try:
                if os.path.isfile(ruta_en_disco):
                    os.remove(ruta_en_disco)
            except OSError:
                pass

        examen.delete()
        return "", 204


api.add_resource(CategoriaExamenList_Resource, "/categorias")
api.add_resource(ExamenesConsultasPaciente_Resource, "/paciente/<int:paciente_id>/consultas")
api.add_resource(ExamenComplementarioObservaciones_Resource, "/<int:examen_id>/observaciones")
api.add_resource(ExamenComplementario_Resource, "/<int:examen_id>")
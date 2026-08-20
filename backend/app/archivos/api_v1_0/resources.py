"""Rutas CRUD del módulo archivos."""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_restful import Api, Resource
from marshmallow import ValidationError
import os
from flask import send_from_directory, abort
from app.archivos.storage import BASE_UPLOAD_DIR


from app.db import db
from app.archivos.models import Archivo
from app.archivos.schemas import ArchivoSchema
from app.archivos.storage import guardar_archivo_en_disco
from app.archivos.api_v1_0 import archivos_bp
from app.examenes_complementarios.models import ExamenComplementario
from app.recetas.models import Receta
from app.historial_clinico.models import RegistroClinico
from app.archivos.models import Archivo
from app.archivos.schemas import ArchivoSchema
from app.examenes_complementarios.models import ExamenComplementario
from app.historial_clinico.models import RegistroClinico, HistoriaClinica
from app.pacientes.models import Paciente
archivo_schema_list = ArchivoSchema(many=True)
schema = ArchivoSchema()
schema_list = ArchivoSchema(many=True)

api = Api(archivos_bp)

# Mapeo del campo -> (modelo, nombre_columna_fk_en_Archivo)
DESTINOS_VALIDOS = {
    "examen_complementario_id": ExamenComplementario,
    "receta_id": Receta,
    "registro_clinico_id": RegistroClinico,
}


class ArchivoUpload_Resource(Resource):
    """
    POST /api/archivos   (multipart/form-data)

    form-data esperado:
      - archivo: File (obligatorio)
      - tipo_archivo_id: int (obligatorio)
      - examen_complementario_id: int (uno de los tres, según a qué se liga)
      - receta_id: int
      - registro_clinico_id: int
    """

    @jwt_required()
    def post(self):
        if "archivo" not in request.files:
            return {"error": "No se envió ningún archivo"}, 400

        file_storage = request.files["archivo"]
        if file_storage.filename == "":
            return {"error": "El archivo está vacío"}, 400

        tipo_archivo_id = request.form.get("tipo_archivo_id")
        if not tipo_archivo_id:
            return {"tipo_archivo_id": ["Requerido"]}, 400

        # Validar que se mandó exactamente un destino, y que ese registro exista.
        destino_campo = None
        destino_id = None
        for campo, Modelo in DESTINOS_VALIDOS.items():
            valor = request.form.get(campo)
            if valor:
                if destino_campo is not None:
                    return {"error": "Solo se puede vincular el archivo a un destino a la vez"}, 400
                if not Modelo.get_by_id(int(valor)):
                    return {"error": f"El {campo} indicado no existe"}, 404
                destino_campo = campo
                destino_id = int(valor)

        if destino_campo is None:
            return {"error": "Debe indicar a qué se vincula el archivo (examen, receta o registro clínico)"}, 400

        try:
            datos_archivo = guardar_archivo_en_disco(file_storage)
        except ValueError as err:
            return {"error": str(err)}, 400

        usuario_id = get_jwt_identity()

        archivo = Archivo(
            tipo_archivo_id=int(tipo_archivo_id),
            subido_por_usuario_id=usuario_id,
            **datos_archivo,
            **{destino_campo: destino_id},
        )
        db.session.add(archivo)
        db.session.commit()

        return schema.dump(archivo), 201


class Archivo_Resource(Resource):
    @jwt_required()
    def get(self, archivo_id):
        archivo = Archivo.get_by_id(archivo_id)
        if not archivo:
            return {"error": "Archivo no encontrado"}, 404
        return schema.dump(archivo), 200

    @jwt_required()
    def delete(self, archivo_id):
        archivo = Archivo.get_by_id(archivo_id)
        if not archivo:
            return {"error": "Archivo no encontrado"}, 404
        archivo.delete()
        return "", 204


class ArchivosPorExamen_Resource(Resource):
    @jwt_required()
    def get(self, examen_id):
        if not ExamenComplementario.get_by_id(examen_id):
            return {"error": "Examen complementario no encontrado"}, 404

        archivos = Archivo.simple_filter(examen_complementario_id=examen_id)
        return schema_list.dump(archivos), 200


class ArchivoDescarga_Resource(Resource):
    """
    GET /api/archivos/<int:archivo_id>/descarga

    Devuelve el binario del archivo (imagen o PDF) para mostrarlo
    directo en el navegador (ej. <img src="...">) o descargarlo.
    """

    @jwt_required()
    def get(self, archivo_id):
        archivo = Archivo.get_by_id(archivo_id)
        if not archivo:
            return {"error": "Archivo no encontrado"}, 404

        # archivo.ruta_almacenamiento es algo como "2026/08/abc123.jpg"
        carpeta = os.path.dirname(os.path.join(BASE_UPLOAD_DIR, archivo.ruta_almacenamiento))
        nombre_archivo_en_disco = os.path.basename(archivo.ruta_almacenamiento)

        if not os.path.isfile(os.path.join(carpeta, nombre_archivo_en_disco)):
            abort(404, description="El archivo ya no existe en disco")

        return send_from_directory(
            carpeta,
            nombre_archivo_en_disco,
            as_attachment=False,          # False = se muestra inline (imágenes/PDF en el navegador)
            download_name=archivo.nombre_archivo,  # nombre original, no el UUID
        )

class ArchivosPorPaciente_Resource(Resource):
    """
    GET /api/pacientes/<int:paciente_id>/archivos

    Devuelve todos los archivos (fotos, PDFs) de exámenes complementarios
    de un paciente, sin importar en qué registro clínico o consulta
    se hayan generado.
    """

    @jwt_required()
    def get(self, paciente_id):
        if not Paciente.get_by_id(paciente_id):
            return {"error": "Paciente no encontrado"}, 404

        archivos = (
            Archivo.query
            .join(ExamenComplementario, ExamenComplementario.id == Archivo.examen_complementario_id)
            .join(RegistroClinico, RegistroClinico.id == ExamenComplementario.registro_clinico_id)
            .join(HistoriaClinica, HistoriaClinica.id == RegistroClinico.historia_clinica_id)
            .filter(HistoriaClinica.paciente_id == paciente_id)
            .order_by(Archivo.created_at.desc())
            .all()
        )
        return archivo_schema_list.dump(archivos), 200
api.add_resource(ArchivoDescarga_Resource, "/<int:archivo_id>/descarga")
api.add_resource(ArchivoUpload_Resource, "/")
api.add_resource(Archivo_Resource, "/<int:archivo_id>")
api.add_resource(ArchivosPorExamen_Resource, "/examen/<int:examen_id>")
api.add_resource(ArchivosPorPaciente_Resource, "/<int:paciente_id>/archivos")
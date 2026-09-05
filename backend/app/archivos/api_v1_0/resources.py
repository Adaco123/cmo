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
from app.tipos_archivo.models import TipoArchivo
from app.archivos import captura_qr
archivo_schema_list = ArchivoSchema(many=True)
schema = ArchivoSchema()
schema_list = ArchivoSchema(many=True)

api = Api(archivos_bp)

# Mapeo del campo -> (modelo, nombre_columna_fk_en_Archivo)
DESTINOS_VALIDOS = {
    "examen_complementario_id": ExamenComplementario,
    "receta_id": Receta,
    "registro_clinico_id": RegistroClinico,
    "paciente_id": Paciente,
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
        try:
            tipo_archivo_id = int(tipo_archivo_id)
        except (TypeError, ValueError):
            return {"tipo_archivo_id": ["Debe ser un número entero"]}, 400
        if not TipoArchivo.get_by_id(tipo_archivo_id):
            return {"error": "El tipo_archivo_id indicado no existe"}, 404

        # Validar que se mandó exactamente un destino, y que ese registro exista.
        destino_campo = None
        destino_id = None
        for campo, Modelo in DESTINOS_VALIDOS.items():
            valor = request.form.get(campo)
            if valor:
                if destino_campo is not None:
                    return {"error": "Solo se puede vincular el archivo a un destino a la vez"}, 400
                try:
                    valor_id = int(valor)
                except (TypeError, ValueError):
                    return {"error": f"El {campo} debe ser un número entero"}, 400
                if not Modelo.get_by_id(valor_id):
                    return {"error": f"El {campo} indicado no existe"}, 404
                destino_campo = campo
                destino_id = valor_id

        if destino_campo is None:
            return {"error": "Debe indicar a qué se vincula el archivo (examen, receta o registro clínico)"}, 400

        try:
            datos_archivo = guardar_archivo_en_disco(file_storage)
        except ValueError as err:
            return {"error": str(err)}, 400

        usuario_id = get_jwt_identity()

        archivo = Archivo(
            tipo_archivo_id=tipo_archivo_id,
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

        ruta_en_disco = os.path.join(BASE_UPLOAD_DIR, archivo.ruta_almacenamiento)
        archivo.delete()

        try:
            if os.path.isfile(ruta_en_disco):
                os.remove(ruta_en_disco)
        except OSError:
            # El registro en BD ya se borró; si el archivo físico no se
            # pudo eliminar (permisos, ya no está ahí, etc.) no bloqueamos
            # la respuesta por eso.
            pass

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

        archivos_examenes = (
            Archivo.query
            .join(ExamenComplementario, ExamenComplementario.id == Archivo.examen_complementario_id)
            .join(RegistroClinico, RegistroClinico.id == ExamenComplementario.registro_clinico_id)
            .join(HistoriaClinica, HistoriaClinica.id == RegistroClinico.historia_clinica_id)
            .filter(HistoriaClinica.paciente_id == paciente_id)
            .all()
        )
        # Archivos subidos directo al paciente (ej. pacientes externos, sin
        # historia clínica todavía).
        archivos_directos = Archivo.simple_filter(paciente_id=paciente_id)

        vistos = {}
        for archivo in [*archivos_examenes, *archivos_directos]:
            vistos[archivo.id] = archivo

        archivos = sorted(vistos.values(), key=lambda a: a.created_at, reverse=True)
        return archivo_schema_list.dump(archivos), 200


# ---------------------------------------------------------------------------
# Captura de fotos por QR desde el celular (ver app/archivos/captura_qr.py).
# Los endpoints bajo /captura/<token> son intencionalmente SIN @jwt_required:
# el celular que escanea el QR no tiene sesión iniciada en el sistema, así
# que la propia validez del token (firmado, con expiración y ligado a un
# único examen) es lo que autoriza la subida.
# ---------------------------------------------------------------------------

TIPO_ARCHIVO_ID_FOTO = 1  # mismo valor que ya usa el frontend para jpg/jpeg/png
EXTENSIONES_FOTO_PERMITIDAS = {"jpg", "jpeg", "png"}


def _extension(nombre_archivo):
    return nombre_archivo.rsplit(".", 1)[1].lower() if "." in nombre_archivo else ""


def _paciente_de_examen(examen):
    registro = RegistroClinico.get_by_id(examen.registro_clinico_id)
    historia = HistoriaClinica.get_by_id(registro.historia_clinica_id) if registro else None
    return Paciente.get_by_id(historia.paciente_id) if historia else None


class QrCapturaIniciar_Resource(Resource):
    """POST /api/archivos/examen/<int:examen_id>/qr-captura  (la PC, con JWT)."""

    @jwt_required()
    def post(self, examen_id):
        if not ExamenComplementario.get_by_id(examen_id):
            return {"error": "Examen complementario no encontrado"}, 404

        usuario_id = get_jwt_identity()
        token, sid = captura_qr.crear_sesion(examen_id, usuario_id)
        return {
            "token": token,
            "sid": sid,
            "expira_en_segundos": captura_qr.QR_CAPTURA_EXPIRA_SEGUNDOS,
        }, 201


class QrCapturaEstado_Resource(Resource):
    """GET /api/archivos/examen/<int:examen_id>/qr-captura/<sid>/estado  (la PC, con JWT, polling)."""

    @jwt_required()
    def get(self, examen_id, sid):
        sesion = captura_qr.obtener_sesion_por_sid(sid)
        if not sesion or sesion["examen_id"] != examen_id:
            return {"error": "Sesión de captura no encontrada o vencida"}, 404

        return {
            "conectado": sesion["conectado"],
            "fotos_count": len(sesion["fotos"]),
            "cerrada": sesion["cerrada"],
        }, 200


class QrCapturaInfo_Resource(Resource):
    """GET /api/archivos/captura/<token>/info  (el celular, sin JWT)."""

    def get(self, token):
        sesion = captura_qr.validar_token(token)
        if not sesion:
            return {"error": "Código QR inválido o expirado"}, 410

        captura_qr.marcar_conectado(sesion)

        examen = ExamenComplementario.get_by_id(sesion["examen_id"])
        paciente = _paciente_de_examen(examen)

        return {
            "nombre_examen": examen.nombre_examen,
            "paciente_nombre": f"{paciente.nombres} {paciente.apellidos}" if paciente else "",
            "fotos_count": len(sesion["fotos"]),
        }, 200


class QrCapturaFoto_Resource(Resource):
    """
    POST   /api/archivos/captura/<token>/foto              (el celular, sin JWT)
    DELETE /api/archivos/captura/<token>/foto/<archivo_id>  (el celular, sin JWT)
    """

    def post(self, token):
        sesion = captura_qr.validar_token(token)
        if not sesion:
            return {"error": "Código QR inválido o expirado"}, 410

        if "archivo" not in request.files:
            return {"error": "No se envió ninguna fotografía"}, 400

        file_storage = request.files["archivo"]
        if file_storage.filename == "":
            return {"error": "El archivo está vacío"}, 400
        if _extension(file_storage.filename) not in EXTENSIONES_FOTO_PERMITIDAS:
            return {"error": "Solo se permiten fotografías (jpg, jpeg, png)"}, 400

        try:
            datos_archivo = guardar_archivo_en_disco(file_storage)
        except ValueError as err:
            return {"error": str(err)}, 400

        archivo = Archivo(
            tipo_archivo_id=TIPO_ARCHIVO_ID_FOTO,
            subido_por_usuario_id=sesion["usuario_id"],
            examen_complementario_id=sesion["examen_id"],
            **datos_archivo,
        )
        db.session.add(archivo)
        db.session.commit()

        captura_qr.agregar_foto(sesion, archivo.id)

        return {**schema.dump(archivo), "fotos_count": len(sesion["fotos"])}, 201

    def delete(self, token, archivo_id):
        sesion = captura_qr.validar_token(token)
        if not sesion:
            return {"error": "Código QR inválido o expirado"}, 410

        if not captura_qr.quitar_foto(sesion, archivo_id):
            return {"error": "Esa fotografía no pertenece a esta sesión de captura"}, 404

        archivo = Archivo.get_by_id(archivo_id)
        if archivo:
            ruta_en_disco = os.path.join(BASE_UPLOAD_DIR, archivo.ruta_almacenamiento)
            archivo.delete()
            try:
                if os.path.isfile(ruta_en_disco):
                    os.remove(ruta_en_disco)
            except OSError:
                pass

        return "", 204


class QrCapturaFinalizar_Resource(Resource):
    """POST /api/archivos/captura/<token>/finalizar  (el celular, sin JWT)."""

    def post(self, token):
        sesion = captura_qr.validar_token(token)
        if not sesion:
            return {"error": "Código QR inválido o expirado"}, 410

        captura_qr.cerrar_sesion(sesion)
        return {"fotos_count": len(sesion["fotos"])}, 200


api.add_resource(ArchivoDescarga_Resource, "/<int:archivo_id>/descarga")
api.add_resource(ArchivoUpload_Resource, "/")
api.add_resource(Archivo_Resource, "/<int:archivo_id>")
api.add_resource(ArchivosPorExamen_Resource, "/examen/<int:examen_id>")
api.add_resource(ArchivosPorPaciente_Resource, "/<int:paciente_id>/archivos")
api.add_resource(QrCapturaIniciar_Resource, "/examen/<int:examen_id>/qr-captura")
api.add_resource(QrCapturaEstado_Resource, "/examen/<int:examen_id>/qr-captura/<string:sid>/estado")
api.add_resource(QrCapturaInfo_Resource, "/captura/<string:token>/info")
api.add_resource(QrCapturaFoto_Resource, "/captura/<string:token>/foto", "/captura/<string:token>/foto/<int:archivo_id>")
api.add_resource(QrCapturaFinalizar_Resource, "/captura/<string:token>/finalizar")
"""Guardado de archivos en disco local para el módulo archivos."""
import os
import uuid
from datetime import datetime
from flask import current_app
from werkzeug.utils import secure_filename

# Antes esto era una constante fija leída una sola vez al importar el
# módulo (os.environ.get(...) a nivel de módulo), lo que la hacía
# depender del orden de imports y no dejaba configurarla por entorno
# (Docker) vía config/default.py, solo vía variable de entorno.
# Ahora se resuelve en cada uso desde app.config, que ya carga
# config/default.py en create_app() — así en Docker basta con setear
# ARCHIVOS_UPLOAD_DIR en ese archivo (o seguir sobreescribiéndolo con
# la variable de entorno del mismo nombre, ambos caminos siguen
# funcionando).
DEFAULT_UPLOAD_DIR = r"D:\archivos"


def get_upload_dir() -> str:
    """Ruta raíz de almacenamiento de archivos, leída de app.config
    (ARCHIVOS_UPLOAD_DIR, definida en config/default.py). Requiere
    contexto de aplicación Flask activo (siempre el caso dentro de
    una request)."""
    return current_app.config.get("ARCHIVOS_UPLOAD_DIR", DEFAULT_UPLOAD_DIR)


EXTENSIONES_PERMITIDAS = {"pdf", "jpg", "jpeg", "png"}


def _extension_valida(nombre_original: str) -> bool:
    return "." in nombre_original and nombre_original.rsplit(".", 1)[1].lower() in EXTENSIONES_PERMITIDAS


def guardar_archivo_en_disco(file_storage) -> dict:
    """
    Recibe el FileStorage de Flask (request.files['archivo']) y lo guarda
    en BASE_UPLOAD_DIR/<año>/<mes>/<nombre_unico>.<ext>, con nombre único
    para evitar colisiones. Devuelve los datos que necesita el modelo Archivo.

    Lanza ValueError si la extensión no está permitida.
    """
    nombre_original = secure_filename(file_storage.filename or "")
    if not nombre_original or not _extension_valida(nombre_original):
        raise ValueError("Tipo de archivo no permitido. Solo PDF, JPG o PNG.")

    ahora = datetime.utcnow()
    subcarpeta = os.path.join(str(ahora.year), f"{ahora.month:02d}")
    carpeta_destino = os.path.join(get_upload_dir(), subcarpeta)
    os.makedirs(carpeta_destino, exist_ok=True)

    extension = nombre_original.rsplit(".", 1)[1].lower()
    nombre_unico = f"{uuid.uuid4().hex}.{extension}"
    ruta_completa = os.path.join(carpeta_destino, nombre_unico)

    file_storage.save(ruta_completa)
    tamano_bytes = os.path.getsize(ruta_completa)

    # Guardamos la ruta con "/" siempre, sin importar el sistema operativo,
    # para que la BD no dependa de si corriste esto en Windows o Linux.
    ruta_relativa = os.path.join(subcarpeta, nombre_unico).replace("\\", "/")

    return {
        "nombre_archivo": nombre_original,
        "ruta_almacenamiento": ruta_relativa,
        "tamano_bytes": tamano_bytes,
    }
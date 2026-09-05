"""Tokens y sesiones para la captura de fotos por QR desde el celular.

No se crea ninguna tabla nueva en la base de datos: el token que va en el QR
es un valor firmado (itsdangerous, la misma librería que ya usa Flask para
firmar cookies) y no se guarda en ningún lado. El estado de la sesión (si el
celular ya se conectó, cuántas fotos van) vive en memoria del proceso mientras
dura la captura — es información temporal, no un registro que tenga sentido
guardar en la BD.

Nota: esto asume un solo proceso Flask corriendo (el despliegue local actual
del sistema). Si en algún momento se corre con varios workers/procesos, este
diccionario dejaría de ser compartido entre ellos y habría que mover esto a
algo externo (ej. Redis).
"""
import time
import uuid

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

QR_CAPTURA_EXPIRA_SEGUNDOS = 600  # 10 minutos para escanear y usar el QR

# sid -> {examen_id, usuario_id, creado_en, conectado, fotos, cerrada}
_SESIONES = {}


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="captura-qr")


def _limpiar_expiradas():
    ahora = time.time()
    vencidas = [sid for sid, s in _SESIONES.items() if ahora - s["creado_en"] > QR_CAPTURA_EXPIRA_SEGUNDOS]
    for sid in vencidas:
        _SESIONES.pop(sid, None)


def crear_sesion(examen_id, usuario_id):
    """Crea una sesión de captura nueva. Devuelve (token, sid)."""
    _limpiar_expiradas()
    sid = uuid.uuid4().hex
    _SESIONES[sid] = {
        "examen_id": examen_id,
        "usuario_id": usuario_id,
        "creado_en": time.time(),
        "conectado": False,
        "fotos": [],
        "cerrada": False,
    }
    token = _serializer().dumps({"sid": sid, "examen_id": examen_id})
    return token, sid


def obtener_sesion_por_sid(sid):
    """Para que la PC consulte el estado (requiere JWT en el endpoint que la use)."""
    _limpiar_expiradas()
    return _SESIONES.get(sid)


def validar_token(token):
    """Verifica firma, expiración y que la sesión siga activa. Devuelve la sesión o None."""
    _limpiar_expiradas()
    try:
        data = _serializer().loads(token, max_age=QR_CAPTURA_EXPIRA_SEGUNDOS)
    except (BadSignature, SignatureExpired):
        return None

    sesion = _SESIONES.get(data.get("sid"))
    if not sesion or sesion["cerrada"] or sesion["examen_id"] != data.get("examen_id"):
        return None
    return sesion


def marcar_conectado(sesion):
    sesion["conectado"] = True


def agregar_foto(sesion, archivo_id):
    sesion["fotos"].append(archivo_id)


def quitar_foto(sesion, archivo_id):
    if archivo_id in sesion["fotos"]:
        sesion["fotos"].remove(archivo_id)
        return True
    return False


def cerrar_sesion(sesion):
    sesion["cerrada"] = True
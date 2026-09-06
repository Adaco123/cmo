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

# sid -> {destino_campo, destino_id, usuario_id, creado_en, conectado, fotos, cerrada}
# destino_campo es el mismo nombre de columna que usa DESTINOS_VALIDOS en
# ArchivoUpload_Resource ("examen_complementario_id" o "paciente_id").
_SESIONES = {}


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="captura-qr")


def _limpiar_expiradas():
    ahora = time.time()
    vencidas = [sid for sid, s in _SESIONES.items() if ahora - s["creado_en"] > QR_CAPTURA_EXPIRA_SEGUNDOS]
    for sid in vencidas:
        _SESIONES.pop(sid, None)


def crear_sesion(destino_campo, destino_id, usuario_id, contexto_paciente_id=None):
    """Crea una sesión de captura nueva.

    destino_campo/destino_id: a qué Archivo real se liga la foto en cuanto
    se sube ("examen_complementario_id" o "paciente_id"). Puede ir en
    (None, None) para una sesión TRANSITORIA: la foto sube sin ningún FK,
    solo para que la PC la descargue y la reubique donde corresponda
    (ej. como File[] pendiente de un examen que ni siquiera existe todavía).

    contexto_paciente_id: solo informativo, para mostrar el nombre del
    paciente en la pantalla del celular cuando destino_campo es None (no
    se usa para ligar el Archivo).

    Devuelve (token, sid).
    """
    _limpiar_expiradas()
    sid = uuid.uuid4().hex
    _SESIONES[sid] = {
        "destino_campo": destino_campo,
        "destino_id": destino_id,
        "contexto_paciente_id": contexto_paciente_id,
        "usuario_id": usuario_id,
        "creado_en": time.time(),
        "conectado": False,
        "fotos": [],
        "cerrada": False,
    }
    token = _serializer().dumps({"sid": sid, "destino_campo": destino_campo, "destino_id": destino_id})
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
    if (
        not sesion
        or sesion["cerrada"]
        or sesion["destino_campo"] != data.get("destino_campo")
        or sesion["destino_id"] != data.get("destino_id")
    ):
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


def eliminar_sesion(sid):
    """Descarta por completo una sesión (ej. al cancelar el registro
    clínico sin guardar). Quien llame a esto es responsable de borrar
    antes los Archivo listados en sesion["fotos"]."""
    _SESIONES.pop(sid, None)
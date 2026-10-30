"""Cliente mínimo para la API de OpenAI (Chat Completions).

Se usa `requests` directo en vez del SDK oficial para no sumar otra
dependencia. La API key sale SIEMPRE de variables de entorno del servidor
(nunca viaja ni se guarda en el frontend).

Variables de entorno:
    OPENAI_API_KEY            obligatoria
    OPENAI_MODEL              por defecto "gpt-5.4-mini"
    OPENAI_REASONING_EFFORT   por defecto "low"; dejarla vacía si el modelo
                              elegido no soporta reasoning_effort
    OPENAI_MAX_OUTPUT_TOKENS  por defecto 4000 (en modelos con razonamiento
                              este tope incluye los tokens de razonamiento)
"""
import os

import requests
from flask import current_app

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODELO_POR_DEFECTO = "gpt-5.4-mini"


class IAError(Exception):
    """Fallo al consultar la IA. `mensaje` es seguro de mostrar al usuario."""

    def __init__(self, mensaje: str, status_code: int = 502):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status_code = status_code


def ia_configurada() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def consultar_openai(system_prompt: str, user_prompt: str) -> dict:
    """Envía un prompt a OpenAI y devuelve {"texto", "modelo", "tokens"}.

    Lanza IAError con un mensaje legible si algo falla.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise IAError("La IA no está configurada en el servidor (falta OPENAI_API_KEY).", 503)

    modelo = os.environ.get("OPENAI_MODEL", "").strip() or MODELO_POR_DEFECTO
    esfuerzo = os.environ.get("OPENAI_REASONING_EFFORT", "low").strip()
    try:
        max_tokens = int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "4000"))
    except ValueError:
        max_tokens = 4000

    payload = {
        "model": modelo,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_completion_tokens": max_tokens,
    }
    if esfuerzo:
        payload["reasoning_effort"] = esfuerzo

    try:
        resp = requests.post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=(10, 100),  # (conectar, leer): gunicorn/nginx cortan a los 120 s
        )
    except requests.Timeout:
        raise IAError("La IA tardó demasiado en responder. Intenta de nuevo.", 504)
    except requests.RequestException:
        current_app.logger.exception("No se pudo conectar con OpenAI")
        raise IAError("No se pudo conectar con el servicio de IA. Revisa la conexión a internet.", 502)

    if resp.status_code != 200:
        raise _error_desde_respuesta(resp)

    try:
        data = resp.json()
        texto = (data["choices"][0]["message"].get("content") or "").strip()
    except (ValueError, KeyError, IndexError, TypeError):
        current_app.logger.error("Respuesta inesperada de OpenAI: %s", resp.text[:500])
        raise IAError("El servicio de IA devolvió una respuesta inesperada.", 502)

    if not texto:
        # Típico cuando el razonamiento consumió todo max_completion_tokens.
        current_app.logger.error(
            "OpenAI devolvió contenido vacío (finish_reason=%s)",
            data["choices"][0].get("finish_reason"),
        )
        raise IAError("La IA no devolvió una respuesta. Intenta de nuevo.", 502)

    uso = data.get("usage") or {}
    return {
        "texto": texto,
        "modelo": data.get("model") or modelo,
        "tokens": {
            "entrada": uso.get("prompt_tokens"),
            "salida": uso.get("completion_tokens"),
        },
    }


def _error_desde_respuesta(resp) -> IAError:
    """Traduce un error HTTP de OpenAI a un mensaje entendible para el médico.

    El detalle técnico va al log del servidor, no al usuario.
    """
    try:
        err = (resp.json() or {}).get("error") or {}
    except ValueError:
        err = {}
    codigo = err.get("code")
    current_app.logger.error(
        "OpenAI respondió %s: code=%s message=%s", resp.status_code, codigo, err.get("message")
    )

    if resp.status_code == 401:
        return IAError("La API key de OpenAI no es válida. Avisa al administrador.", 502)
    if resp.status_code == 429:
        if codigo == "insufficient_quota":
            return IAError("Se agotó el saldo de la cuenta de OpenAI. Avisa al administrador.", 502)
        return IAError("Demasiadas consultas seguidas a la IA. Espera unos segundos e intenta de nuevo.", 429)
    if resp.status_code == 404 or codigo == "model_not_found":
        return IAError("El modelo de IA configurado no existe o no está disponible para esta cuenta.", 502)
    if resp.status_code == 400:
        return IAError("La IA rechazó la consulta (revisa OPENAI_MODEL / OPENAI_REASONING_EFFORT en el servidor).", 502)
    return IAError("El servicio de IA no está disponible en este momento. Intenta más tarde.", 502)
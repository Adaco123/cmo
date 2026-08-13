"""Blueprint del módulo tipos_archivo."""
from flask import Blueprint

tipos_archivo_bp = Blueprint("tipos_archivo", __name__)

from app.tipos_archivo.api_v1_0 import resources  # noqa: E402,F401

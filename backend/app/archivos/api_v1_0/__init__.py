"""Blueprint del módulo archivos."""
from flask import Blueprint

archivos_bp = Blueprint("archivos", __name__)

from app.archivos.api_v1_0 import resources  # noqa: E402,F401

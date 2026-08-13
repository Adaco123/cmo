"""Blueprint del módulo informes_ecografia."""
from flask import Blueprint

historial_clinico_bp = Blueprint("historias_clinicas", __name__)

from app.historial_clinico.api_v1_0 import resources  # noqa: E402,F401

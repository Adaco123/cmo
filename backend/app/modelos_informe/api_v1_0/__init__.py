"""Blueprint del módulo modelos_informe."""
from flask import Blueprint

modelos_informe_bp = Blueprint("modelos_informe", __name__)

from app.modelos_informe.api_v1_0 import resources  # noqa: E402,F401

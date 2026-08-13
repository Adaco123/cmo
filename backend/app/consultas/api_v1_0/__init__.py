"""Blueprint del módulo consultas."""
from flask import Blueprint

consultas_bp = Blueprint("consultas", __name__)

from app.consultas.api_v1_0 import resources  # noqa: E402,F401

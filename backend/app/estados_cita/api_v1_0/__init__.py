"""Blueprint del módulo estados_cita."""
from flask import Blueprint

estados_cita_bp = Blueprint("estados_cita", __name__)

from app.estados_cita.api_v1_0 import resources  # noqa: E402,F401

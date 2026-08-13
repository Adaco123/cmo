"""Blueprint del módulo origenes_paciente."""
from flask import Blueprint

origenes_paciente_bp = Blueprint("origenes_paciente", __name__)

from app.origenes_paciente.api_v1_0 import resources  # noqa: E402,F401

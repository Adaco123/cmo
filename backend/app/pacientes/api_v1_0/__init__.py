"""Blueprint del módulo pacientes."""
from flask import Blueprint

pacientes_bp = Blueprint("pacientes", __name__)

from app.pacientes.api_v1_0 import resources  # noqa: E402,F401

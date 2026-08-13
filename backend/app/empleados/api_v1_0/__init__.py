"""Blueprint del módulo empleados."""
from flask import Blueprint

empleados_bp = Blueprint("empleados", __name__)

from app.empleados.api_v1_0 import resources  # noqa: E402,F401

"""Blueprint del módulo pagos."""
from flask import Blueprint

seguimiento_bp = Blueprint("seguimiento", __name__)

from app.seguimiento_control.api_v1_0 import resources  # noqa: E402,F401

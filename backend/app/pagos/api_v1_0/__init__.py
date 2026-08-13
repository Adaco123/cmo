"""Blueprint del módulo pagos."""
from flask import Blueprint

pagos_bp = Blueprint("pagos", __name__)

from app.pagos.api_v1_0 import resources  # noqa: E402,F401

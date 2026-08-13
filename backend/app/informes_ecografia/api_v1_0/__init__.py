"""Blueprint del módulo informes_ecografia."""
from flask import Blueprint

informes_ecografia_bp = Blueprint("informes_ecografia", __name__)

from app.informes_ecografia.api_v1_0 import resources  # noqa: E402,F401

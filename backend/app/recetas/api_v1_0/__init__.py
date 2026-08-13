"""Blueprint del módulo pagos."""
from flask import Blueprint

recetas_bp = Blueprint("recetas", __name__)

from app.recetas.api_v1_0 import resources  # noqa: E402,F401

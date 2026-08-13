"""Blueprint del módulo usuarios."""
from flask import Blueprint

usuarios_bp = Blueprint("usuarios", __name__)

from app.usuarios.api_v1_0 import resources  # noqa: E402,F401

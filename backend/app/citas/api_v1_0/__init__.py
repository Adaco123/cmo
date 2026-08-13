"""Blueprint del módulo citas."""
from flask import Blueprint

citas_bp = Blueprint("citas", __name__)

from app.citas.api_v1_0 import resources  # noqa: E402,F401

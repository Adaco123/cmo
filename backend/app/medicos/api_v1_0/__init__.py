"""Blueprint del módulo medicos."""
from flask import Blueprint

medicos_bp = Blueprint("medicos", __name__)

from app.medicos.api_v1_0 import resources  # noqa: E402,F401

"""Blueprint del módulo estados_cobro."""
from flask import Blueprint

estados_cobro_bp = Blueprint("estados_cobro", __name__)

from app.estados_cobro.api_v1_0 import resources  # noqa: E402,F401

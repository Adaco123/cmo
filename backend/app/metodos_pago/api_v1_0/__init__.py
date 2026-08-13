"""Blueprint del módulo metodos_pago."""
from flask import Blueprint

metodos_pago_bp = Blueprint("metodos_pago", __name__)

from app.metodos_pago.api_v1_0 import resources  # noqa: E402,F401

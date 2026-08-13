"""Blueprint del módulo cobros."""
from flask import Blueprint

cobros_bp = Blueprint("cobros", __name__)

from app.cobros.api_v1_0 import resources  # noqa: E402,F401

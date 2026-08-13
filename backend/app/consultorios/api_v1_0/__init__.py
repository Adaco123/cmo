"""Blueprint del módulo consultorios."""
from flask import Blueprint

consultorios_bp = Blueprint("consultorios", __name__)

from app.consultorios.api_v1_0 import resources  # noqa: E402,F401

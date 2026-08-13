"""Blueprint del módulo auditoria."""
from flask import Blueprint

auditoria_bp = Blueprint("auditoria", __name__)

from app.auditoria.api_v1_0 import resources  # noqa: E402,F401

"""Blueprint del módulo roles."""
from flask import Blueprint

roles_bp = Blueprint("roles", __name__)

from app.roles.api_v1_0 import resources  # noqa: E402,F401

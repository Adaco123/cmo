"""Blueprint del módulo categorias_modelo."""
from flask import Blueprint

categorias_modelo_bp = Blueprint("categorias_modelo", __name__)

from app.categorias_modelo.api_v1_0 import resources  # noqa: E402,F401

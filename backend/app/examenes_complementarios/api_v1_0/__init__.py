
from flask import Blueprint

examenes_complementarios_bp = Blueprint("examenes_complementarios", __name__)

from app.examenes_complementarios.api_v1_0 import resources  # noqa: E402,F401

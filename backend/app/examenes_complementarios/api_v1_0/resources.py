"""Rutas del módulo historial_clinico."""
from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from app.examenes_complementarios.models import CategoriaExamen, ExamenComplementario
from app.examenes_complementarios.schemas import ExamenComplementarioSchema
from app.examenes_complementarios.api_v1_0 import examenes_complementarios_bp

api = Api(examenes_complementarios_bp)

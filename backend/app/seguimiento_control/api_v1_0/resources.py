from flask import request
from flask_jwt_extended import jwt_required
from flask_restful import Api, Resource
from app.seguimiento_control.models import SeguimientoControl
from app.seguimiento_control.schemas import SeguimientoControlSchema
from app.seguimiento_control.api_v1_0 import seguimiento_bp
from app.historial_clinico.models import RegistroClinico
from app.medicos.models import Medico
from app.recetas.schemas import RecetaSchema

from app.db import db

api = Api(seguimiento_bp)

seguimiento_schema = SeguimientoControlSchema()
seguimiento_schema_list = SeguimientoControlSchema(many=True)
receta_schema = RecetaSchema()


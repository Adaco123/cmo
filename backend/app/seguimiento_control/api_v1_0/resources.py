from flask import request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from flask_restful import Api
from app.seguimiento_control.models import SeguimientoControl

from app.seguimiento_control.api_v1_0 import seguimiento_bp

api= Api(seguimiento_bp)

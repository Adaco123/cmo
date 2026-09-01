"""Rutas del módulo cobros."""
from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from app.cobros.models import Cobro
from app.cobros.schemas import CobroSchema
from app.cobros.api_v1_0 import cobros_bp
from app.consultas.models import Consulta
from app.pacientes.models import Paciente
from app.estados_cobro.models import EstadoCobro
from app.pagos.models import Pago

schema = CobroSchema()
schema_list = CobroSchema(many=True)

api = Api(cobros_bp)


def _estado_por_nombre(nombre):
    encontrados = EstadoCobro.simple_filter(nombre=nombre)
    return encontrados[0] if encontrados else None


class CobrosList_Resource(Resource):
    @jwt_required()
    def get(self):
        items = Cobro.get_all()
        return schema_list.dump(items), 200

    @jwt_required()
    def post(self):
        try:
            data = schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        if not Consulta.get_by_id(data["consulta_id"]):
            return {"error": "La consulta indicada no existe"}, 404
        if not Paciente.get_by_id(data["paciente_id"]):
            return {"error": "El paciente indicado no existe"}, 404
        if Cobro.simple_filter(consulta_id=data["consulta_id"]):
            return {"error": "Esa consulta ya tiene un cobro registrado"}, 409

        estado_pendiente = _estado_por_nombre("Pendiente")
        if not estado_pendiente:
            return {"error": "Falta configurar el catálogo estados_cobro (falta 'Pendiente')"}, 500

        monto = data["monto"]
        descuento = data.get("descuento") or 0

        # El monto_final, el estado inicial y quién lo registró los calcula
        # el sistema; nunca se confían al cliente.
        monto_final = monto - descuento
        if monto_final <= 0:
            return {"error": "El descuento no puede ser mayor o igual al monto."}, 400

        data["monto_final"] = monto_final
        data["estado_id"] = estado_pendiente.id
        data["usuario_id"] = current_user.id

        cobro = Cobro(**data)
        cobro.save()
        return schema.dump(cobro), 201


class Cobro_Resource(Resource):
    @jwt_required()
    def get(self, item_id):
        item = Cobro.get_by_id(item_id)
        if not item:
            return {"error": "Cobro no encontrado"}, 404
        return schema.dump(item), 200

    @jwt_required()
    def put(self, item_id):
        item = Cobro.get_by_id(item_id)
        if not item:
            return {"error": "Cobro no encontrado"}, 404

        try:
            data = schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        # El estado y quién lo registró los gestiona el sistema (vía pagos),
        # no se editan a mano.
        data.pop("estado_id", None)
        data.pop("usuario_id", None)

        if "monto" in data or "descuento" in data:
            monto = data.get("monto", item.monto)
            descuento = data.get("descuento", item.descuento)
            nuevo_monto_final = monto - descuento
            if nuevo_monto_final <= 0:
                return {"error": "El descuento no puede ser mayor o igual al monto."}, 400
            item.monto_final = nuevo_monto_final

        for key, value in data.items():
            setattr(item, key, value)
        item.save()
        return schema.dump(item), 200

    @jwt_required()
    def delete(self, item_id):
        item = Cobro.get_by_id(item_id)
        if not item:
            return {"error": "Cobro no encontrado"}, 404
        if Pago.simple_filter(cobro_id=item.id):
            return {
                "error": "Este cobro ya tiene pagos registrados y no se puede eliminar"
            }, 409
        item.delete()
        return "", 204


api.add_resource(CobrosList_Resource, "/")
api.add_resource(Cobro_Resource, "/<int:item_id>")
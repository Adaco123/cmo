from decimal import Decimal, InvalidOperation

from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from app.pagos.models import Pago
from app.pagos.schemas import PagoSchema
from app.pagos.api_v1_0 import pagos_bp
from app.cobros.models import Cobro
from app.consultas.models import Consulta
from app.metodos_pago.models import MetodoPago
from app.estados_cobro.models import EstadoCobro
from app.db import db

schema = PagoSchema()
schema_list = PagoSchema(many=True)

api = Api(pagos_bp)

ESTADO_PAGADO_ID = 1


def _estado_pagado():
    return EstadoCobro.get_by_id(ESTADO_PAGADO_ID)


def _estado_por_nombre(nombre):
    # Mismo patrón que cobros/api_v1_0/resources.py: no asumimos un id fijo
    # para "Pendiente" porque, a diferencia de "Pagado", no hay una
    # constante establecida para él en este módulo.
    encontrados = EstadoCobro.simple_filter(nombre=nombre)
    return encontrados[0] if encontrados else None


def _to_decimal(valor, default="0"):
    """Convierte un valor crudo del JSON (float/int/str/None) a Decimal
    de forma segura, pasando siempre por str() para no heredar el error
    de precisión binaria de los floats."""
    if valor is None:
        valor = default
    try:
        return Decimal(str(valor))
    except InvalidOperation:
        return Decimal(default)


def _recalcular_estado_cobro(cobro):
    pagos = Pago.simple_filter(cobro_id=cobro.id)
    total_pagado = sum(p.monto for p in pagos)

    # Antes esto marcaba "Pagado" incondicionalmente en cada llamada, sin
    # comparar contra el saldo real: un pago parcial (o incluso anular el
    # único pago de un cobro) dejaba el cobro como "Pagado" igual, y como
    # PagosList_Resource.post rechaza nuevos pagos sobre un cobro ya
    # "Pagado", el saldo restante quedaba imposible de cobrar.
    if total_pagado >= cobro.monto_final:
        nuevo_estado = _estado_pagado()
    else:
        nuevo_estado = _estado_por_nombre("Pendiente")

    if nuevo_estado:
        cobro.estado_id = nuevo_estado.id
        cobro.save()

    return total_pagado


class PagosList_Resource(Resource):
    @jwt_required()
    def get(self):
        items = Pago.get_all()
        return schema_list.dump(items), 200

    @jwt_required()
    def post(self):
        
        payload = request.get_json(force=True) or {}
        try:
            data = schema.load(payload)
        except ValidationError as err:
            return err.messages, 400

        if data.get("cobro_id"):
            cobro = Cobro.get_by_id(data["cobro_id"])
            if not cobro:
                return {"error": "El cobro indicado no existe"}, 404
            if not MetodoPago.get_by_id(data["metodo_pago_id"]):
                return {"error": "El método de pago indicado no existe"}, 404

            estado_actual = EstadoCobro.get_by_id(cobro.estado_id)
            if cobro.estado_id == ESTADO_PAGADO_ID or (
                estado_actual and estado_actual.id == ESTADO_PAGADO_ID
            ):
                return {"error": "Este cobro ya está pagado, no admite más pagos"}, 409

            pagos_previos = Pago.simple_filter(cobro_id=cobro.id)
            pagado_hasta_ahora = sum(p.monto for p in pagos_previos)
            saldo_pendiente = cobro.monto_final - pagado_hasta_ahora
            if data["monto"] > saldo_pendiente:
                return {
                    "error": f"El monto excede el saldo pendiente ({saldo_pendiente})"
                }, 400

            data["numero_recibo_pago"] = f"{cobro.numero_recibo}-P{len(pagos_previos) + 1}"
            data["usuario_id"] = current_user.id

            pago = Pago(**data)
            pago.save()

            _recalcular_estado_cobro(cobro)

            return schema.dump(pago), 201

        if not payload.get("consulta_id"):
            return {"error": "Falta consulta_id para crear el cobro"}, 400
        if not Consulta.get_by_id(payload["consulta_id"]):
            return {"error": "La consulta indicada no existe"}, 404
        if Cobro.simple_filter(consulta_id=payload["consulta_id"]):
            return {"error": "Esa consulta ya tiene un cobro registrado"}, 409
        if not MetodoPago.get_by_id(data["metodo_pago_id"]):
            return {"error": "El método de pago indicado no existe"}, 404

        estado_pagado = _estado_pagado()
        if not estado_pagado:
            return {"error": "Falta configurar el catálogo estados_cobro (falta el estado 'Pagado' con id 1)"}, 500

        monto = data.get("monto")
        if monto is None:
            return {"error": "Falta monto para crear el cobro"}, 400

        descuento = _to_decimal(data.get("descuento"))
        monto_final = monto - descuento
        if monto_final < 0:
            return {"error": "El descuento no puede exceder el monto del cobro"}, 400

        cobro = Cobro(
            consulta_id=payload["consulta_id"],
            monto=monto,
            descuento=descuento,
            monto_final=monto_final,
            estado_id=estado_pagado.id,
            numero_recibo=payload.get("numero_recibo") or f"CBR-{Cobro.query.count() + 1}",
            fecha=payload.get("fecha"),
            usuario_id=current_user.id,
        )

        pago_monto = (
            _to_decimal(data.get("monto_pago"), default=str(monto_final))
            if data.get("monto_pago") is not None
            else monto_final
        )
        if pago_monto > monto_final:
            return {"error": f"El monto del pago excede el saldo pendiente ({monto_final})"}, 400

        pago = Pago(
            cobro_id=None,
            monto=pago_monto,
            metodo_pago_id=data["metodo_pago_id"],
            numero_recibo_pago=payload.get("numero_recibo_pago") or f"{cobro.numero_recibo}-P1",
            referencia=data.get("referencia"),
            usuario_id=current_user.id,
        )

        try:
            db.session.add(cobro)
            db.session.flush()
            pago.cobro_id = cobro.id
            db.session.add(pago)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        _recalcular_estado_cobro(cobro)

        return schema.dump(pago), 201


class Pago_Resource(Resource):
    @jwt_required()
    def get(self, item_id):
        item = Pago.get_by_id(item_id)
        if not item:
            return {"error": "Pago no encontrado"}, 404
        return schema.dump(item), 200

    @jwt_required()
    def delete(self, item_id):
        # Anular un pago (no se permite editar el monto de uno ya registrado,
        # solo eliminarlo) y recalcular el estado del cobro correspondiente.
        item = Pago.get_by_id(item_id)
        if not item:
            return {"error": "Pago no encontrado"}, 404

        cobro = Cobro.get_by_id(item.cobro_id)
        item.delete()
        if cobro:
            _recalcular_estado_cobro(cobro)
        return "", 204


class PagosPorCobro_Resource(Resource):
    @jwt_required()
    def get(self, cobro_id):
        if not Cobro.get_by_id(cobro_id):
            return {"error": "Cobro no encontrado"}, 404
        pagos = Pago.simple_filter(cobro_id=cobro_id)
        return schema_list.dump(pagos), 200

class PagosResumenHoy_Resource(Resource):
    @jwt_required()
    def get(self):
        total, cantidad = Pago.resumen_pagos_hoy_bolivia()
        return {
            "total_pagado_hoy": str(total),
            "cantidad_pagos": cantidad,
        }, 200


class PagosReporteMensualDiario_Resource(Resource):
    @jwt_required()
    def get(self):
        return Pago.resumen_pagos_diario_mes_bolivia(), 200


class PagosReporteMensual_Resource(Resource):
    @jwt_required()
    def get(self):
        total, cantidad = Pago.resumen_pagos_mes_bolivia()
        return {
            "total_pagado_mes": str(total),
            "cantidad_pagos": cantidad,
        }, 200


api.add_resource(PagosResumenHoy_Resource, "/resumenHoy")
api.add_resource(PagosList_Resource, "/")
api.add_resource(Pago_Resource, "/<int:item_id>")
api.add_resource(PagosPorCobro_Resource, "/cobro/<int:cobro_id>")
api.add_resource(PagosReporteMensualDiario_Resource, "/reporteMensualDiario")
api.add_resource(PagosReporteMensual_Resource, "/reporteMensual")
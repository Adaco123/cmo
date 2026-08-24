"""Rutas CRUD del módulo pacientes usando Resource."""
from datetime import date, timedelta

from flask import request
from flask_jwt_extended import jwt_required
from flask_restful import Api, Resource
from marshmallow import ValidationError
from sqlalchemy import func

from app.db import db
from app.pacientes.models import Paciente
from app.pacientes.schemas import PacienteSchema
from app.pacientes.api_v1_0 import pacientes_bp
from app.historial_clinico.models import HistoriaClinica
from app.consultas.models import Consulta

schema = PacienteSchema()
schema_list = PacienteSchema(many=True)
api = Api(pacientes_bp)


class PacientesList_Resource(Resource):
    @jwt_required()
    def get(self):
        items = Paciente.get_all()
        return schema_list.dump(items), 200

    @jwt_required()
    def post(self):
        try:
            data = schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        item = Paciente(**data)
        item.save()

        historia_clinica = HistoriaClinica(paciente_id=item.id, estado=True)
        historia_clinica.save()

        return schema.dump(item), 201


class Paciente_Resource(Resource):
    @jwt_required()
    def get(self, item_id):
        item = Paciente.get_by_id(item_id)
        if item is None:
            return {"error": "Paciente no encontrado"}, 404
        return schema.dump(item), 200

    @jwt_required()
    def put(self, item_id):
        item = Paciente.get_by_id(item_id)
        if item is None:
            return {"error": "Paciente no encontrado"}, 404

        try:
            data = schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        for key, value in data.items():
            setattr(item, key, value)
        item.save()
        return schema.dump(item), 200

    @jwt_required()
    def delete(self, item_id):
        item = Paciente.get_by_id(item_id)
        if item is None:
            return {"error": "Paciente no encontrado"}, 404

        item.delete()
        return "", 204


class PacientesEstadisticasMes_Resource(Resource):
    """Total de pacientes nuevos este mes vs. el mes anterior."""

    @jwt_required()
    def get(self):
        hoy = date.today()

        inicio_mes_actual = hoy.replace(day=1)

        ultimo_dia_mes_anterior = inicio_mes_actual - timedelta(days=1)
        inicio_mes_anterior = ultimo_dia_mes_anterior.replace(day=1)

        total_actual = (
            db.session.query(func.count(Paciente.id))
            .filter(func.date(Paciente.created_at) >= inicio_mes_actual)
            .scalar()
        ) or 0

        total_anterior = (
            db.session.query(func.count(Paciente.id))
            .filter(
                func.date(Paciente.created_at) >= inicio_mes_anterior,
                func.date(Paciente.created_at) <= ultimo_dia_mes_anterior,
            )
            .scalar()
        ) or 0

        if total_anterior == 0:
            variacion_porcentual = 100.0 if total_actual > 0 else 0.0
        else:
            variacion_porcentual = round(
                ((total_actual - total_anterior) / total_anterior) * 100, 2
            )

        return {
            "total_mes_actual": total_actual,
            "total_mes_anterior": total_anterior,
            "variacion_absoluta": total_actual - total_anterior,
            "variacion_porcentual": variacion_porcentual,
        }, 200


class PacientesFrecuentes_Resource(Resource):
    """Pacientes con más consultas: nombre, total consultas, última visita y tipo."""

    @jwt_required()
    def get(self):
        limit = request.args.get("limit", default=10, type=int)

        resultados = (
            db.session.query(
                Paciente.id,
                Paciente.nombres,
                Paciente.apellidos,
                Paciente.origen_id,
                func.count(Consulta.id).label("total_consultas"),
                func.max(Consulta.fecha).label("ultima_visita"),
            )
            .join(Consulta, Consulta.paciente_id == Paciente.id)
            .group_by(Paciente.id)
            .order_by(func.count(Consulta.id).desc())
            .limit(limit)
            .all()
        )

        data = []
        for row in resultados:
            tipo = "Mis pacientes" if row.origen_id == 1 else "Externo" if row.origen_id == 2 else "Otro"
            data.append({
                "id": row.id,
                "nombre": f"{row.nombres} {row.apellidos}",
                "total_consultas": row.total_consultas,
                "ultima_visita": row.ultima_visita.isoformat() if row.ultima_visita else None,
                "tipo": tipo,
            })

        return data, 200


class PacientesNuevos_Resource(Resource):
    """Pacientes registrados en los últimos 30 días."""

    @jwt_required()
    def get(self):
        dias = request.args.get("dias", default=30, type=int)
        desde = date.today() - timedelta(days=dias)

        items = (
            Paciente.query
            .filter(func.date(Paciente.created_at) >= desde)
            .order_by(Paciente.created_at.desc())
            .all()
        )

        return {
            "total": len(items),
            "pacientes": schema_list.dump(items),
        }, 200


api.add_resource(PacientesList_Resource, '/')
api.add_resource(Paciente_Resource, '/<int:item_id>')
api.add_resource(PacientesEstadisticasMes_Resource, '/estadisticas/mes')
api.add_resource(PacientesFrecuentes_Resource, '/frecuentes')
api.add_resource(PacientesNuevos_Resource, '/nuevos')
"""Rutas del módulo historial_clinico."""
from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from app.db import db
from app.consultas.schemas import ConsultaSchema
from app.medicos.models import Medico
from app.citas.models import Cita   # solo si vas a validar cita_id
from app.historial_clinico.models import HistoriaClinica, RegistroClinico
from app.historial_clinico.schemas import HistoriaClinicaSchema, RegistroClinicoSchema
from app.historial_clinico.api_v1_0 import historial_clinico_bp
from app.pacientes.models import Paciente
from app.pacientes.schemas import PacienteSchema
from app.consultas.models import Consulta

from app.recetas.models import TipoReceta, Receta, RecetaMedicamento, RecetaFormulaMagistral, RecetaExamen
from app.recetas.schemas import RecetaSchema, RecetaMedicamentoSchema, RecetaFormulaMagistralSchema, RecetaExamenSchema

from app.examenes_complementarios.models import CategoriaExamen, ExamenComplementario
from app.examenes_complementarios.schemas import ExamenComplementarioSchema
historia_schema = HistoriaClinicaSchema()
registro_schema = RegistroClinicoSchema()
registro_schema_list = RegistroClinicoSchema(many=True)
paciente_schema = PacienteSchema()

api = Api(historial_clinico_bp)


# ---------------------------------------------------------------------------
# Historia Clínica
# ---------------------------------------------------------------------------

class HistoriaClinicaList_Resource(Resource):
    @jwt_required()
    def post(self):
        try:
            data = historia_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        if not Paciente.get_by_id(data["paciente_id"]):
            return {"error": "El paciente indicado no existe"}, 404

        if HistoriaClinica.simple_filter(paciente_id=data["paciente_id"]):
            return {"error": "El paciente ya tiene una historia clínica registrada"}, 409

        historia = HistoriaClinica(**data)
        historia.save()
        return historia_schema.dump(historia), 201


class HistoriaClinica_Resource(Resource):
    @jwt_required()
    def get(self, historia_id):
        historia = HistoriaClinica.get_by_id(historia_id)
        if not historia:
            return {"error": "Historia clínica no encontrada"}, 404
        return historia_schema.dump(historia), 200

    @jwt_required()
    def put(self, historia_id):
        historia = HistoriaClinica.get_by_id(historia_id)
        if not historia:
            return {"error": "Historia clínica no encontrada"}, 404

        try:
            data = historia_schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        # El paciente dueño de una historia clínica no se reasigna por edición.
        data.pop("paciente_id", None)

        for key, value in data.items():
            setattr(historia, key, value)
        historia.save()
        return historia_schema.dump(historia), 200

    @jwt_required()
    def delete(self, historia_id):
        historia = HistoriaClinica.get_by_id(historia_id)
        if not historia:
            return {"error": "Historia clínica no encontrada"}, 404

        # Regla del sistema: no se elimina una historia clínica con registros
        # asociados, para no perder el expediente médico del paciente.
        if historia.registros_clinicos:
            return {
                "error": "No se puede eliminar: la historia clínica tiene registros clínicos asociados"
            }, 409

        historia.delete()
        return "", 204


class HistoriaClinicaPorPaciente_Resource(Resource):
    @jwt_required()
    def get(self, paciente_id):
        historias = HistoriaClinica.simple_filter(paciente_id=paciente_id)
        if not historias:
            return {"error": "El paciente no tiene historia clínica registrada"}, 404
        return historia_schema.dump(historias[0]), 200


# ---------------------------------------------------------------------------
# Registro Clínico
# ---------------------------------------------------------------------------

class RegistroClinicoList_Resource(Resource):
    @jwt_required()
    def post(self):
        try:
            data = registro_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        # consulta_id es ahora obligatorio: RegistroClinico depende 1:1 de
        # Consulta, y paciente/médico/fecha/hora/diagnóstico se derivan de ahí,
        # ya no se reciben en el body.
        consulta = Consulta.get_by_id(data["consulta_id"])
        if not consulta:
            return {"error": "La consulta indicada no existe"}, 404

        paciente_id = consulta.paciente_id

        # Historia clínica 1:1 por paciente: se reutiliza si ya existe,
        # o se abre automáticamente si es la primera atención registrada.
        historias = HistoriaClinica.simple_filter(paciente_id=paciente_id)
        historia = historias[0] if historias else HistoriaClinica(paciente_id=paciente_id, estado=True)
        if not historias:
            historia.save()

        data["historia_clinica_id"] = historia.id
        registro = RegistroClinico(**data)
        registro.save()
        return registro_schema.dump(registro), 201


class RegistroClinico_Resource(Resource):
    @jwt_required()
    def get(self, registro_id):
        registro = RegistroClinico.get_by_id(registro_id)
        if not registro:
            return {"error": "Registro clínico no encontrado"}, 404
        return registro_schema.dump(registro), 200

    @jwt_required()
    def put(self, registro_id):
        registro = RegistroClinico.get_by_id(registro_id)
        if not registro:
            return {"error": "Registro clínico no encontrado"}, 404

        try:
            data = registro_schema.load(request.get_json(force=True) or {}, partial=True)
        except ValidationError as err:
            return err.messages, 400

        # La historia clínica y la consulta de un registro no se reasignan
        # por edición (identidad fija una vez creado el registro).
        data.pop("historia_clinica_id", None)
        data.pop("consulta_id", None)

        for key, value in data.items():
            setattr(registro, key, value)
        registro.save()
        return registro_schema.dump(registro), 200

    @jwt_required()
    def delete(self, registro_id):
        registro = RegistroClinico.get_by_id(registro_id)
        if not registro:
            return {"error": "Registro clínico no encontrado"}, 404
        registro.delete()
        return "", 204


class RegistrosPorHistoria_Resource(Resource):
    @jwt_required()
    def get(self, historia_id):
        if not HistoriaClinica.get_by_id(historia_id):
            return {"error": "Historia clínica no encontrada"}, 404

        registros = (
            RegistroClinico.query
            .join(Consulta, Consulta.id == RegistroClinico.consulta_id)
            .filter(RegistroClinico.historia_clinica_id == historia_id)
            .order_by(Consulta.fecha.desc(), Consulta.hora.desc())
            .all()
        )
        return registro_schema_list.dump(registros), 200


# ---------------------------------------------------------------------------
# Expediente completo del paciente (paciente + historia + registros)
# ---------------------------------------------------------------------------

class ExpedientePaciente_Resource(Resource):
    @jwt_required()
    def get(self, paciente_id):
        paciente = Paciente.get_by_id(paciente_id)
        if not paciente:
            return {"error": "Paciente no encontrado"}, 404

        historias = HistoriaClinica.simple_filter(paciente_id=paciente_id)
        if not historias:
            return {"error": "El paciente no tiene historia clínica registrada"}, 404
        historia = historias[0]

        registros = (
            RegistroClinico.query
            .join(Consulta, Consulta.id == RegistroClinico.consulta_id)
            .filter(RegistroClinico.historia_clinica_id == historia.id)
            .order_by(Consulta.fecha.desc(), Consulta.hora.desc())
            .all()
        )

        return {
            "paciente": paciente_schema.dump(paciente),
            "historia_clinica": {
                "id": historia.id,
                "fecha_apertura": historia.fecha_apertura.isoformat() if historia.fecha_apertura else None,
                "estado": historia.estado,
            },
            "registros_clinicos": registro_schema_list.dump(registros),
        }, 200

consulta_schema = ConsultaSchema()

"""
REEMPLAZA la clase RegistroClinicoCompleto_Resource que te pasé antes
(la versión que solo hacía consulta + registro). Esta versión agrega
exámenes complementarios y recetas separadas por tipo, todo en la
misma transacción.

Agregar/ajustar imports al inicio de app/historial_clinico/routes.py:

    

Y junto a las instancias de schema que ya tienes:

    """

consulta_schema = ConsultaSchema()
receta_schema = RecetaSchema()
receta_medicamento_schema = RecetaMedicamentoSchema()
receta_formula_schema = RecetaFormulaMagistralSchema()
receta_examen_schema = RecetaExamenSchema()
examen_complementario_schema = ExamenComplementarioSchema()

# Nombres canónicos — deben coincidir exactamente con lo que envía el
# frontend en `categoria` (exámenes complementarios) y con la clave de
# cada bloque dentro de `recetas` (medicamentos / examenes / formulas).
CATEGORIAS_EXAMEN_VALIDAS = {"Laboratorio", "Imagenología", "Otro"}
TIPOS_RECETA_NOMBRES = {
    "medicamentos": "Medicamentos",
    "examenes": "Exámenes",
    "formulas": "Fórmulas magistrales",
}


def _get_or_create_categoria_examen(nombre: str) -> "CategoriaExamen":
    categoria = CategoriaExamen.query.filter_by(nombre=nombre).first()
    if not categoria:
        categoria = CategoriaExamen(nombre=nombre)
        db.session.add(categoria)
        db.session.flush()
    return categoria


def _get_or_create_tipo_receta(nombre: str) -> "TipoReceta":
    tipo = TipoReceta.query.filter_by(nombre=nombre).first()
    if not tipo:
        tipo = TipoReceta(nombre=nombre)
        db.session.add(tipo)
        db.session.flush()
    return tipo


class RegistroClinicoCompleto_Resource(Resource):
    """
    POST /api/historial_clinico/registro-completo

    Crea, en una sola transacción: la Consulta, el RegistroClinico,
    los ExamenComplementario que el médico haya pedido, y una Receta
    independiente por cada tipo (medicamentos / exámenes / fórmulas)
    que tenga al menos un ítem. Si cualquier paso falla, se revierte
    todo — no queda nada guardado a medias.
    """

    @jwt_required()
    def post(self):
        body = request.get_json(force=True) or {}
        consulta_data = body.get("consulta", {})
        registro_data = body.get("registro", {})
        examenes_data = body.get("examenes_complementarios", []) or []
        recetas_data = body.get("recetas", {}) or {}

        # --- Validación de forma ---
        try:
            consulta_validated = consulta_schema.load(consulta_data)
        except ValidationError as err:
            return {"consulta": err.messages}, 400

        try:
            registro_validated = registro_schema.load(registro_data, partial=("consulta_id",))
        except ValidationError as err:
            return {"registro": err.messages}, 400

        examenes_validated = []
        for i, ex in enumerate(examenes_data):
            categoria_nombre = ex.get("categoria")
            if categoria_nombre not in CATEGORIAS_EXAMEN_VALIDAS:
                return {
                    "examenes_complementarios": {
                        i: {"categoria": [f"Debe ser una de: {sorted(CATEGORIAS_EXAMEN_VALIDAS)}"]}
                    }
                }, 400
            nombre_examen = (ex.get("nombre_examen") or "").strip()
            if not nombre_examen:
                return {"examenes_complementarios": {i: {"nombre_examen": ["Requerido"]}}}, 400
            examenes_validated.append({
                "categoria_nombre": categoria_nombre,
                "nombre_examen": nombre_examen,
                "observaciones": (ex.get("observaciones") or "").strip() or None,
            })

        recetas_validated = {}  # clave: 'medicamentos'|'examenes'|'formulas'
        for clave, item_schema in (
            ("medicamentos", receta_medicamento_schema),
            ("examenes", receta_examen_schema),
            ("formulas", receta_formula_schema),
        ):
            bloque = recetas_data.get(clave)
            if not bloque or not bloque.get("items"):
                continue

            items_validados = []
            for i, item in enumerate(bloque["items"]):
                try:
                    # receta_id es dump_only en estos schemas (se asigna
                    # desde la URL normalmente); aquí lo asignamos luego
                    # de crear la Receta, así que no hace falta excluirlo.
                    items_validados.append(item_schema.load(item))
                except ValidationError as err:
                    return {"recetas": {clave: {"items": {i: err.messages}}}}, 400

            recetas_validated[clave] = {
                "indicaciones_generales": bloque.get("indicaciones_generales") or None,
                "items": items_validados,
            }

        # --- Validación de relaciones ---
        if not Paciente.get_by_id(consulta_validated["paciente_id"]):
            return {"error": "El paciente indicado no existe"}, 404
        if not Medico.get_by_id(consulta_validated["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404

        cita_id = consulta_validated.get("cita_id")
        if cita_id is not None:
            if not Cita.get_by_id(cita_id):
                return {"error": "La cita indicada no existe"}, 404
            if Consulta.simple_filter(cita_id=cita_id):
                return {"error": "Esa cita ya generó una consulta"}, 409

        paciente_id = consulta_validated["paciente_id"]
        medico_id = consulta_validated["medico_id"]

        historias = HistoriaClinica.simple_filter(paciente_id=paciente_id)
        historia_existente = bool(historias)
        historia = historias[0] if historias else HistoriaClinica(paciente_id=paciente_id, estado=True)

        # --- Transacción: todo o nada ---
        try:
            if not historia_existente:
                db.session.add(historia)
                db.session.flush()

            consulta = Consulta(**consulta_validated)
            db.session.add(consulta)
            db.session.flush()

            registro_validated["consulta_id"] = consulta.id
            registro_validated["historia_clinica_id"] = historia.id
            registro = RegistroClinico(**registro_validated)
            db.session.add(registro)
            db.session.flush()

            for ex in examenes_validated:
                categoria = _get_or_create_categoria_examen(ex["categoria_nombre"])
                examen = ExamenComplementario(
                    registro_clinico_id=registro.id,
                    categoria_id=categoria.id,
                    nombre_examen=ex["nombre_examen"],
                    observaciones=ex["observaciones"],
                )
                db.session.add(examen)

            recetas_creadas = []
            item_model_by_clave = {
                "medicamentos": RecetaMedicamento,
                "examenes": RecetaExamen,
                "formulas": RecetaFormulaMagistral,
            }
            for clave, bloque in recetas_validated.items():
                tipo = _get_or_create_tipo_receta(TIPOS_RECETA_NOMBRES[clave])

                receta = Receta(
                    registro_clinico_id=registro.id,
                    tipo_receta_id=tipo.id,
                    medico_id=medico_id,
                    indicaciones_generales=bloque["indicaciones_generales"],
                )
                db.session.add(receta)
                db.session.flush()

                ItemModel = item_model_by_clave[clave]
                for item_data in bloque["items"]:
                    db.session.add(ItemModel(receta_id=receta.id, **item_data))

                recetas_creadas.append(receta)

            db.session.commit()
        except Exception:
            db.session.rollback()
            return {"error": "No se pudo guardar el registro clínico completo"}, 500

        return {
            "consulta": consulta_schema.dump(consulta),
            "registro": registro_schema.dump(registro),
            "examenes_complementarios": examen_complementario_schema.dump(
                registro.examenes_complementarios, many=True
            ),
            "recetas": receta_schema.dump(recetas_creadas, many=True),
        }, 201


api.add_resource(RegistroClinicoCompleto_Resource, "/registro-completo")

api.add_resource(HistoriaClinicaList_Resource, "/historias")
api.add_resource(HistoriaClinica_Resource, "/historias/<int:historia_id>")
api.add_resource(HistoriaClinicaPorPaciente_Resource, "/historias/paciente/<int:paciente_id>")

api.add_resource(RegistroClinicoList_Resource, "/registros")
api.add_resource(RegistroClinico_Resource, "/registros/<int:registro_id>")
api.add_resource(RegistrosPorHistoria_Resource, "/registros/historia/<int:historia_id>")

api.add_resource(ExpedientePaciente_Resource, "/paciente/<int:paciente_id>")
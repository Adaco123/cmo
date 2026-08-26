"""Rutas del módulo historial_clinico."""
from datetime import datetime

from flask import request, current_app
from flask_restful import Api, Resource
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from app.db import db
from app.consultas.schemas import ConsultaSchema
from app.medicos.models import Medico
from app.citas.models import Cita
from app.historial_clinico.models import HistoriaClinica, RegistroClinico
from app.seguimiento_control.models import SeguimientoControl
from app.historial_clinico.schemas import (
    HistoriaClinicaSchema,
    RegistroClinicoSchema,
    SeguimientoControlSchema,
)
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
consulta_schema = ConsultaSchema()
receta_schema = RecetaSchema()
receta_medicamento_schema = RecetaMedicamentoSchema()
receta_formula_schema = RecetaFormulaMagistralSchema()
receta_examen_schema = RecetaExamenSchema()
examen_complementario_schema = ExamenComplementarioSchema()
seguimiento_schema = SeguimientoControlSchema()
seguimiento_schema_list = SeguimientoControlSchema(many=True)

api = Api(historial_clinico_bp)

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


def _parse_fecha(valor, campo: str = "proxima_fecha_control"):
    """
    Convierte 'YYYY-MM-DD' a date, o None si viene vacío/None.
    Lanza ValueError con mensaje legible si el formato es inválido.
    Necesario porque este endpoint arma el dict de seguimiento_control
    a mano (no pasa por SeguimientoControlSchema.load), así que Marshmallow
    nunca convierte el string a date por sí solo — sin esto, SQLAlchemy
    recibe un str en una columna Date y revienta al hacer flush/commit.
    """
    if not valor:
        return None
    try:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    except (ValueError, TypeError) as e:
        raise ValueError(f"{campo}: formato inválido, use YYYY-MM-DD") from e


def _validar_bloques_recetas(recetas_data: dict):
    """Devuelve (recetas_validated, None) o (None, error_response).

    Cada clave ("medicamentos" / "examenes" / "formulas") ahora acepta una
    LISTA de bloques -> cada bloque de la lista se convierte en una Receta
    separada (esto es lo que permite que el doctor agregue "otra receta"
    de medicamentos aparte, en vez de que todo caiga en la misma).

    Por compatibilidad hacia atrás también se acepta un único bloque como
    dict suelto (formato viejo); se envuelve en una lista de un elemento.
    """
    recetas_validated = {}
    for clave, item_schema in (
        ("medicamentos", receta_medicamento_schema),
        ("examenes", receta_examen_schema),
        ("formulas", receta_formula_schema),
    ):
        bloques = recetas_data.get(clave)
        if not bloques:
            continue
        if isinstance(bloques, dict):
            bloques = [bloques]

        bloques_validados = []
        for b, bloque in enumerate(bloques):
            items = bloque.get("items")
            if not items:
                continue

            items_validados = []
            for i, item in enumerate(items):
                try:
                    items_validados.append(item_schema.load(item))
                except ValidationError as err:
                    return None, (
                        {"recetas": {clave: {b: {"items": {i: err.messages}}}}}, 400
                    )

            bloques_validados.append({
                "indicaciones_generales": bloque.get("indicaciones_generales") or None,
                "items": items_validados,
            })

        if bloques_validados:
            recetas_validated[clave] = bloques_validados
    return recetas_validated, None


def _crear_recetas_desde_bloques(recetas_validated: dict, registro_clinico_id: int,
                                  medico_id: int, seguimiento_control_id=None):
    """Crea las Receta + sus ítems dentro de la transacción activa.

    recetas_validated: clave -> lista de bloques; cada bloque de la lista
    se guarda como su propia fila Receta (una por cada "receta" que el
    doctor haya agregado por separado en el frontend).
    """
    item_model_by_clave = {
        "medicamentos": RecetaMedicamento,
        "examenes": RecetaExamen,
        "formulas": RecetaFormulaMagistral,
    }
    recetas_creadas = []
    for clave, bloques in recetas_validated.items():
        tipo = _get_or_create_tipo_receta(TIPOS_RECETA_NOMBRES[clave])
        ItemModel = item_model_by_clave[clave]

        for bloque in bloques:
            receta = Receta(
                registro_clinico_id=registro_clinico_id,
                tipo_receta_id=tipo.id,
                medico_id=medico_id,
                seguimiento_control_id=seguimiento_control_id,
                indicaciones_generales=bloque["indicaciones_generales"],
            )
            db.session.add(receta)
            db.session.flush()

            for item_data in bloque["items"]:
                db.session.add(ItemModel(receta_id=receta.id, **item_data))

            recetas_creadas.append(receta)
    return recetas_creadas


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
# Registro Clínico (CRUD simple, sin todo el paquete)
# ---------------------------------------------------------------------------

class RegistroClinicoList_Resource(Resource):
    @jwt_required()
    def post(self):
        try:
            data = registro_schema.load(request.get_json(force=True) or {})
        except ValidationError as err:
            return err.messages, 400

        consulta = Consulta.get_by_id(data["consulta_id"])
        if not consulta:
            return {"error": "La consulta indicada no existe"}, 404

        paciente_id = consulta.paciente_id
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
# Expediente completo del paciente
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


# ---------------------------------------------------------------------------
# Registro clínico completo (día 1: consulta + registro + exámenes + recetas
# + opcionalmente el primer seguimiento_control)
# ---------------------------------------------------------------------------

class RegistroClinicoCompleto_Resource(Resource):
    """
    POST /api/historial_clinico/registro-completo

    Crea, en una sola transacción: la Consulta, el RegistroClinico, los
    ExamenComplementario, una Receta por tipo con ítems, y opcionalmente
    el primer SeguimientoControl (con su propia receta). Si algo falla,
    se revierte todo.
    """

    @jwt_required()
    def post(self):
        body = request.get_json(force=True) or {}
        consulta_data = body.get("consulta", {})
        registro_data = body.get("registro", {})
        examenes_data = body.get("examenes_complementarios", []) or []
        recetas_data = body.get("recetas", {}) or {}
        seguimiento_data = body.get("seguimiento_control")

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
                "resultado": (ex.get("resultado") or "").strip() or None,
                "observaciones": (ex.get("observaciones") or "").strip() or None,
            })

        recetas_validated, error = _validar_bloques_recetas(recetas_data)
        if error:
            return error

        seguimiento_validated = None
        seguimiento_recetas_validated = {}
        if seguimiento_data:
            evolucion = (seguimiento_data.get("evolucion") or "").strip()
            if not evolucion:
                return {"seguimiento_control": {"evolucion": ["Requerido"]}}, 400

            # 👇 fix: antes se mandaba el string crudo directo al modelo
            # (nunca pasaba por SeguimientoControlSchema.load), y SQLAlchemy
            # rechazaba el str en la columna Date -> 500 al hacer commit.
            try:
                proxima_fecha_control = _parse_fecha(
                    seguimiento_data.get("proxima_fecha_control")
                )
            except ValueError as err:
                return {"seguimiento_control": {"proxima_fecha_control": [str(err)]}}, 400

            seguimiento_validated = {
                "evolucion": evolucion,
                "proxima_fecha_control": proxima_fecha_control,
            }
            seguimiento_recetas_validated, error = _validar_bloques_recetas(
                seguimiento_data.get("recetas", {}) or {}
            )
            if error:
                return error

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

            # 👇 lista propia, en el mismo orden en que se mandaron —
            # ya no se lee registro.examenes_complementarios al final,
            # porque el orden de esa relación no está garantizado.
            examenes_creados = []
            for ex in examenes_validated:
                categoria = _get_or_create_categoria_examen(ex["categoria_nombre"])
                examen = ExamenComplementario(
                    registro_clinico_id=registro.id,
                    categoria_id=categoria.id,
                    nombre_examen=ex["nombre_examen"],
                    resultado=ex["resultado"],
                    observaciones=ex["observaciones"],
                )
                db.session.add(examen)
                examenes_creados.append(examen)

            recetas_creadas = _crear_recetas_desde_bloques(
                recetas_validated, registro.id, medico_id
            )

            seguimiento = None
            if seguimiento_validated:
                seguimiento = SeguimientoControl(
                    registro_clinico_id=registro.id,
                    medico_id=medico_id,
                    evolucion=seguimiento_validated["evolucion"],
                    proxima_fecha_control=seguimiento_validated["proxima_fecha_control"],
                )
                db.session.add(seguimiento)
                db.session.flush()

                recetas_creadas += _crear_recetas_desde_bloques(
                    seguimiento_recetas_validated, registro.id, medico_id,
                    seguimiento_control_id=seguimiento.id,
                )

            db.session.commit()
        except Exception:
            db.session.rollback()
            # 👇 log del traceback real — antes se perdía y solo veías
            # el 500 genérico sin poder saber la causa.
            current_app.logger.exception("Error guardando registro clínico completo")
            return {"error": "No se pudo guardar el registro clínico completo"}, 500

        respuesta = {
            "consulta": consulta_schema.dump(consulta),
            "registro": registro_schema.dump(registro),
            "examenes_complementarios": examen_complementario_schema.dump(
                examenes_creados, many=True   # 👈 usa la lista, no la relación
            ),
            "recetas": receta_schema.dump(recetas_creadas, many=True),
        }
        if seguimiento:
            respuesta["seguimiento_control"] = seguimiento_schema.dump(seguimiento)

        return respuesta, 201


class RegistroClinicoCompletoUpdate_Resource(Resource):
    """
    PUT /api/historial_clinico/registro-completo/<int:registro_id>

    Actualiza, en una sola transacción: los campos editables de la
    Consulta (motivo, diagnostico, fecha, hora, medico_id, estado —
    paciente_id y cita_id quedan fijos, no se pueden cambiar acá) y los
    datos del RegistroClinico (signos vitales, información clínica).

    Si el body trae "examenes_complementarios", cada uno se procesa así:
      - con "id"  -> actualiza el examen existente (debe pertenecer a
                     este registro).
      - sin "id"  -> crea un examen nuevo.
    Este endpoint NUNCA borra un examen solo porque no venga en la
    lista — si el examen ya existía y no lo mandas, simplemente lo deja
    tal cual está, sin tocarlo. Borrar un examen es una acción aparte
    (explícita), no algo que pase por omisión.

    Las recetas NO se tocan en este endpoint — se editan con sus propios
    endpoints (PUT /recetas/<id>, /recetas/<id>/medicamentos,
    /recetas/examenes/<id>, /recetas/formulas/<id>).
    """

    @jwt_required()
    def put(self, registro_id):
        registro = RegistroClinico.get_by_id(registro_id)
        if not registro:
            return {"error": "Registro clínico no encontrado"}, 404

        consulta = registro.consulta
        body = request.get_json(force=True) or {}
        consulta_data = dict(body.get("consulta") or {})
        registro_data = body.get("registro", {}) or {}
        examenes_data = body.get("examenes_complementarios")  # None = no tocar

        # --- Validación de forma ---
        # paciente_id y cita_id no se editan acá aunque vengan en el body.
        consulta_data.pop("paciente_id", None)
        consulta_data.pop("cita_id", None)
        try:
            consulta_validated = consulta_schema.load(consulta_data, partial=True)
        except ValidationError as err:
            return {"consulta": err.messages}, 400

        try:
            registro_validated = registro_schema.load(registro_data, partial=True)
        except ValidationError as err:
            return {"registro": err.messages}, 400
        registro_validated.pop("consulta_id", None)
        registro_validated.pop("historia_clinica_id", None)

        # --- Validación de relaciones ---
        if "medico_id" in consulta_validated and not Medico.get_by_id(consulta_validated["medico_id"]):
            return {"error": "El médico indicado no existe"}, 404

        examenes_actualizar = []  # [(instancia_existente, datos_dict)]
        examenes_crear = []       # [datos_dict]

        if examenes_data is not None:
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

                datos = {
                    "categoria_nombre": categoria_nombre,
                    "nombre_examen": nombre_examen,
                    "resultado": (ex.get("resultado") or "").strip() or None,
                    "observaciones": (ex.get("observaciones") or "").strip() or None,
                }

                examen_id = ex.get("id")
                if examen_id:
                    examen_existente = ExamenComplementario.get_by_id(int(examen_id))
                    if not examen_existente or examen_existente.registro_clinico_id != registro.id:
                        return {
                            "examenes_complementarios": {i: {"id": ["No pertenece a este registro clínico"]}}
                        }, 404
                    examenes_actualizar.append((examen_existente, datos))
                else:
                    examenes_crear.append(datos)

        # --- Transacción: todo o nada ---
        try:
            for key, value in consulta_validated.items():
                setattr(consulta, key, value)

            for key, value in registro_validated.items():
                setattr(registro, key, value)

            for examen_existente, datos in examenes_actualizar:
                categoria = _get_or_create_categoria_examen(datos["categoria_nombre"])
                examen_existente.categoria_id = categoria.id
                examen_existente.nombre_examen = datos["nombre_examen"]
                examen_existente.resultado = datos["resultado"]
                examen_existente.observaciones = datos["observaciones"]

            for datos in examenes_crear:
                categoria = _get_or_create_categoria_examen(datos["categoria_nombre"])
                db.session.add(ExamenComplementario(
                    registro_clinico_id=registro.id,
                    categoria_id=categoria.id,
                    nombre_examen=datos["nombre_examen"],
                    resultado=datos["resultado"],
                    observaciones=datos["observaciones"],
                ))

            db.session.commit()
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Error actualizando registro clínico completo")
            return {"error": "No se pudo actualizar el registro clínico completo"}, 500

        return {
            "consulta": consulta_schema.dump(consulta),
            "registro": registro_schema.dump(registro),
            "examenes_complementarios": examen_complementario_schema.dump(
                registro.examenes_complementarios, many=True
            ),
        }, 200

# ---------------------------------------------------------------------------
# Seguimientos de control (día 15, 22, 29... cada visita posterior)
# ---------------------------------------------------------------------------

class SeguimientoControl_Resource(Resource):
    """
    GET  /api/historial_clinico/registros/<int:registro_id>/seguimientos
    POST /api/historial_clinico/registros/<int:registro_id>/seguimientos
    """

    @jwt_required()
    def get(self, registro_id):
        if not RegistroClinico.get_by_id(registro_id):
            return {"error": "Registro clínico no encontrado"}, 404

        seguimientos = (
            SeguimientoControl.query
            .filter_by(registro_clinico_id=registro_id)
            .order_by(SeguimientoControl.fecha.asc())
            .all()
        )
        return seguimiento_schema_list.dump(seguimientos), 200

    @jwt_required()
    def post(self, registro_id):
        registro = RegistroClinico.get_by_id(registro_id)
        if not registro:
            return {"error": "Registro clínico no encontrado"}, 404

        body = request.get_json(force=True) or {}
        medico_id = body.get("medico_id")
        evolucion = (body.get("evolucion") or "").strip()
        recetas_data = body.get("recetas", {}) or {}

        if not Medico.get_by_id(medico_id):
            return {"error": "El médico indicado no existe"}, 404
        if not evolucion:
            return {"evolucion": ["Requerido"]}, 400

        # 👇 mismo fix que en registro-completo: convertir antes de pasarlo
        # al modelo, no dejar que llegue como str crudo a la columna Date.
        try:
            proxima_fecha_control = _parse_fecha(body.get("proxima_fecha_control"))
        except ValueError as err:
            return {"proxima_fecha_control": [str(err)]}, 400

        recetas_validated, error = _validar_bloques_recetas(recetas_data)
        if error:
            return error

        try:
            seguimiento = SeguimientoControl(
                registro_clinico_id=registro.id,
                medico_id=medico_id,
                evolucion=evolucion,
                proxima_fecha_control=proxima_fecha_control,
            )
            db.session.add(seguimiento)
            db.session.flush()

            recetas_creadas = _crear_recetas_desde_bloques(
                recetas_validated, registro.id, medico_id,
                seguimiento_control_id=seguimiento.id,
            )

            db.session.commit()
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Error guardando seguimiento de control")
            return {"error": "No se pudo guardar el seguimiento de control"}, 500

        return {
            "seguimiento": seguimiento_schema.dump(seguimiento),
            "recetas": receta_schema.dump(recetas_creadas, many=True),
        }, 201

class RegistroClinicoDetalleCompleto_Resource(Resource):
    """
    GET /api/historial_clinico/registros/<int:registro_id>/completo

    Devuelve el registro clínico junto con TODO lo relacionado:
    exámenes complementarios (con sus archivos), recetas por tipo,
    y los seguimientos de control con sus propias recetas.
    """

    @jwt_required()
    def get(self, registro_id):
        registro = RegistroClinico.get_by_id(registro_id)
        if not registro:
            return {"error": "Registro clínico no encontrado"}, 404

        seguimientos = (
            SeguimientoControl.query
            .filter_by(registro_clinico_id=registro_id)
            .order_by(SeguimientoControl.fecha.asc())
            .all()
        )

        return {
            "registro": registro_schema.dump(registro),
            "examenes_complementarios": examen_complementario_schema.dump(
                registro.examenes_complementarios, many=True
            ),
            "recetas": receta_schema.dump(registro.recetas, many=True),
            "seguimientos_control": seguimiento_schema_list.dump(seguimientos),
        }, 200
class SeguimientoControlList_Resource(Resource):
    """
    GET /api/historial_clinico/seguimientos

    Listado global de seguimientos de control (todos los registros),
    usado por el calendario del dashboard.
    """

    @jwt_required()
    def get(self):
        seguimientos = (
            SeguimientoControl.query
            .order_by(SeguimientoControl.fecha.asc())
            .all()
        )
        return seguimiento_schema_list.dump(seguimientos), 200
api.add_resource(SeguimientoControlList_Resource, "/seguimientos")
api.add_resource(RegistroClinicoDetalleCompleto_Resource, "/registros/<int:registro_id>/completo")
api.add_resource(RegistroClinicoCompleto_Resource, "/registro-completo")
api.add_resource(RegistroClinicoCompletoUpdate_Resource, "/registro-completo/<int:registro_id>")

api.add_resource(HistoriaClinicaList_Resource, "/historias")
api.add_resource(HistoriaClinica_Resource, "/historias/<int:historia_id>")
api.add_resource(HistoriaClinicaPorPaciente_Resource, "/historias/paciente/<int:paciente_id>")

api.add_resource(RegistroClinicoList_Resource, "/registros")
api.add_resource(RegistroClinico_Resource, "/registros/<int:registro_id>")
api.add_resource(RegistrosPorHistoria_Resource, "/registros/historia/<int:historia_id>")

api.add_resource(SeguimientoControl_Resource, "/registros/<int:registro_id>/seguimientos")

api.add_resource(ExpedientePaciente_Resource, "/paciente/<int:paciente_id>")
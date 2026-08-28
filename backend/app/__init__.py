import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.db import db
from app.extensions import ma, migrate
from app.usuarios.models import Usuario
from app.archivos.api_v1_0 import archivos_bp
from app.auditoria.api_v1_0 import auditoria_bp
from app.categorias_modelo.api_v1_0 import categorias_modelo_bp
from app.citas.api_v1_0 import citas_bp
from app.cobros.api_v1_0 import cobros_bp
from app.consultas.api_v1_0 import consultas_bp
from app.consultorios.api_v1_0 import consultorios_bp
from app.empleados.api_v1_0 import empleados_bp
from app.estados_cita.api_v1_0 import estados_cita_bp
from app.estados_cobro.api_v1_0 import estados_cobro_bp
from app.seguimiento_control.api_v1_0 import seguimiento_bp
from app.informes_ecografia.api_v1_0 import informes_ecografia_bp
from app.medicos.api_v1_0 import medicos_bp
from app.metodos_pago.api_v1_0 import metodos_pago_bp
from app.modelos_informe.api_v1_0 import modelos_informe_bp
from app.origenes_paciente.api_v1_0 import origenes_paciente_bp
from app.pacientes.api_v1_0 import pacientes_bp
from app.pagos.api_v1_0 import pagos_bp
from app.historial_clinico.api_v1_0 import historial_clinico_bp
from app.historial_clinico.api_v1_0.reporte import historial_clinico_reportes_bp
from app.historial_clinico.api_v1_0.consentimiento import historial_clinico_consentimiento_bp
from app.roles.api_v1_0 import roles_bp
from app.tipos_archivo.api_v1_0 import tipos_archivo_bp
from app.usuarios.api_v1_0 import usuarios_bp
from app.recetas.api_v1_0 import recetas_bp
from app.examenes_complementarios.api_v1_0 import examenes_complementarios_bp
jwt = JWTManager()

BLUEPRINTS = (
    (archivos_bp, "/api/archivos"),
    (auditoria_bp, "/api/auditoria"),
    (categorias_modelo_bp, "/api/categorias_modelo"),
    (citas_bp, "/api/citas"),
    (cobros_bp, "/api/cobros"),
    (consultas_bp, "/api/consultas"),
    (consultorios_bp, "/api/consultorios"),
    (empleados_bp, "/api/empleados"),
    (estados_cita_bp, "/api/estados_cita"),
    (estados_cobro_bp, "/api/estados_cobro"),
    (historial_clinico_bp, "/api/historial_clinico"),
    (historial_clinico_reportes_bp, "/api/historial_clinico/reportes"),
    (historial_clinico_consentimiento_bp, "/api/historial_clinico/reportes"),
    (informes_ecografia_bp, "/api/informes_ecografia"),
    (medicos_bp, "/api/medicos"),
    (metodos_pago_bp, "/api/metodos_pago"),
    (modelos_informe_bp, "/api/modelos_informe"),
    (origenes_paciente_bp, "/api/origenes_paciente"),
    (pacientes_bp, "/api/pacientes"),
    (pagos_bp, "/api/pagos"),
    (roles_bp, "/api/roles"),
    (tipos_archivo_bp, "/api/tipos_archivo"),
    (usuarios_bp, "/api/usuarios"),
    (recetas_bp,"/api/recetas"),
    (examenes_complementarios_bp,"api/examenes"),
    (seguimiento_bp,"api/seguimiento")
    
)


def create_app(settings_module):
    app = Flask(__name__)
    app.config.from_object(settings_module)
    app.config["JWT_SECRET_KEY"] = app.config.get("SECRET_KEY") or os.environ.get("JWT_SECRET_KEY", "1a2v")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]

    cors_origins = app.config.get("CORS_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
    if not allowed_origins:
        allowed_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://balanced-contentment-production-b0f7.up.railway.app",
        ]

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": allowed_origins,
                "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )

    jwt.init_app(app)
    db.init_app(app)
    ma.init_app(app)
    migrate.init_app(app, db)

    app.url_map.strict_slashes = False

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data.get("sub") or jwt_data.get("identity")
        if not identity:
            return None
        try:
            identity = int(identity)
        except (TypeError, ValueError):
            pass
        return Usuario.query.get(identity)

    for blueprint, prefix in BLUEPRINTS:
        app.register_blueprint(blueprint, url_prefix=prefix)

    register_error_handlers(app)

    return app


def register_error_handlers(app):
    pass
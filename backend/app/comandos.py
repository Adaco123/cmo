"""Comandos de consola (flask <comando>) para tareas de administración.

Se ejecutan en el servidor, no por la API, así que no dependen de ningún
usuario logueado: sirven para crear el PRIMER administrador en una instalación
nueva (p. ej. un contenedor Docker en otra PC) o para crear uno de rescate.

    flask crear-administrador
    docker compose exec backend flask crear-administrador
"""
import re

import click
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

from app.db import db
from app.empleados.models import Empleado
from app.empleados.schemas import EmpleadoSchema
from app.medicos.models import Medico
from app.medicos.schemas import MedicoSchema
from app.roles.api_v1_0.resources import _asegurar_roles_por_defecto
from app.roles.models import Rol
from app.shared.permisos import ROL_ADMINISTRADOR
from app.usuarios.models import Usuario
from app.usuarios.schemas import UsuarioSchema

# Mismas reglas de cuenta que el alta completa (medicos/api_v1_0/resources.py)
_USUARIO_REGEX = r'^[A-Za-z0-9_.]{3,50}$'


def registrar_comandos(app):

    @app.cli.command("crear-administrador")
    @click.option("--usuario", prompt="Usuario", help="Nombre de usuario (3-50 caracteres: letras, números, _ y .)")
    @click.option("--correo", prompt="Correo")
    @click.option("--contra", prompt="Contraseña (mín. 8 caracteres)", hide_input=True,
                  confirmation_prompt=True, envvar="ADMIN_CONTRA",
                  help="Si no se indica, se pide por consola sin mostrarla.")
    @click.option("--nombres", prompt="Nombres")
    @click.option("--apellidos", prompt="Apellidos")
    @click.option("--documento", prompt="Documento (CI)")
    @click.option("--telefono", prompt="Teléfono (opcional, Enter para omitir)", default="", show_default=False)
    @click.option("--especialidad", prompt="Especialidad")
    @click.option("--matricula", prompt="Matrícula profesional")
    def crear_administrador(usuario, correo, contra, nombres, apellidos,
                            documento, telefono, especialidad, matricula):
        """Crea un Administrador completo: cuenta + empleado + médico, en una sola transacción.

        Se puede ejecutar cuantas veces haga falta (crea un administrador
        nuevo cada vez); nunca modifica ni borra usuarios existentes.
        """
        # Roles: en una base nueva la tabla está vacía, se siembran aquí.
        try:
            _asegurar_roles_por_defecto()
        except (OperationalError, ProgrammingError):
            db.session.rollback()
            raise click.ClickException(
                "No se pudo leer la tabla de roles: la base de datos no está lista "
                "(¿faltan las tablas? aplica primero las migraciones: flask db upgrade)."
            )
        rol = Rol.query.filter_by(nombre=ROL_ADMINISTRADOR).first()
        if rol is None:
            raise click.ClickException(f"No existe el rol {ROL_ADMINISTRADOR}.")

        usuario, correo = usuario.strip(), correo.strip()
        telefono = telefono.strip() or None

        # --- Validación de forma (mismos schemas que la API) ---
        try:
            usuario_validated = UsuarioSchema().load(
                {"usuario": usuario, "correo": correo, "rol_id": rol.id},
                partial=("contrasena_hash",),
            )
            empleado_validated = EmpleadoSchema().load(
                {"nombres": nombres.strip() or None, "apellidos": apellidos.strip() or None,
                 "documento": documento.strip() or None, "telefono": telefono},
                partial=("usuario_id",),
            )
            medico_validated = MedicoSchema().load(
                {"especialidad": especialidad.strip() or None,
                 "matricula_profesional": matricula.strip() or None},
                partial=("empleado_id",),
            )
        except ValidationError as err:
            raise click.ClickException(f"Datos inválidos: {err.messages}")

        if not re.match(_USUARIO_REGEX, usuario):
            raise click.ClickException("El usuario debe tener entre 3 y 50 caracteres alfanuméricos.")
        if not contra.strip():
            raise click.ClickException("La contraseña no puede estar vacía.")
        if len(contra) < 8:
            raise click.ClickException("La contraseña debe tener al menos 8 caracteres.")

        # --- Unicidad ---
        if Usuario.get_by_usuario(usuario):
            raise click.ClickException(f"El usuario {usuario} ya existe.")
        if Usuario.get_by_correo(correo):
            raise click.ClickException(f"El correo {correo} ya está siendo utilizado por otro usuario.")
        if Empleado.simple_filter(documento=empleado_validated["documento"]):
            raise click.ClickException(f"Ya existe un empleado con el documento {empleado_validated['documento']}.")
        if Medico.simple_filter(matricula_profesional=medico_validated["matricula_profesional"]):
            raise click.ClickException(f"La matrícula {medico_validated['matricula_profesional']} ya está registrada.")

        # --- Transacción: todo o nada ---
        try:
            nuevo = Usuario(**usuario_validated)
            nuevo.set_password(contra)
            db.session.add(nuevo)
            db.session.flush()

            empleado_validated["usuario_id"] = nuevo.id
            empleado = Empleado(**empleado_validated)
            db.session.add(empleado)
            db.session.flush()

            medico_validated["empleado_id"] = empleado.id
            medico = Medico(**medico_validated)
            db.session.add(medico)

            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise click.ClickException("Alguno de los datos únicos (usuario, correo, documento o matrícula) ya está en uso.")
        except Exception as err:
            db.session.rollback()
            raise click.ClickException(f"No se pudo crear el administrador: {err}")

        click.echo(
            f"Administrador creado: usuario={nuevo.usuario} (id {nuevo.id}), "
            f"empleado_id={empleado.id}, medico_id={medico.id}"
        )
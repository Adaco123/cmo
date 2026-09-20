"""Permisos reutilizables por los endpoints: qué rol es administrador y el
decorador @admin_required.

Vive en shared/ (y no en usuarios/) para que cualquier módulo pueda usarlo sin
importar el archivo de resources de otro módulo.
"""
from functools import wraps

from flask_jwt_extended import current_user

# Único rol que el código reconoce por nombre (ver ROLES_POR_DEFECTO en
# roles/api_v1_0/resources.py). "Médico" no da ningún permiso especial.
ROL_ADMINISTRADOR = "Administrador"
ROLES_ADMIN = {ROL_ADMINISTRADOR}


def es_admin(usuario):
    """True si el usuario tiene un rol de administrador.

    Úsalo para chequeos condicionales dentro de un endpoint (p. ej. "cualquiera
    puede editarse a sí mismo, pero solo un admin cambia el rol"). Para
    proteger un endpoint completo usa @admin_required.
    """
    return bool(usuario) and bool(usuario.rol) and usuario.rol.nombre in ROLES_ADMIN


def admin_required(fn):
    """Solo deja pasar a un Administrador activo. Va DEBAJO de @jwt_required():

        @jwt_required()
        @admin_required
        def post(self): ...

    - Usuario desactivado (estado=False) -> 401. El callback de JWT solo carga
      el usuario y no mira `estado`, así que sin esto un usuario desactivado
      seguiría entrando hasta que expire su access token.
    - No es administrador -> 403.

    Devuelve la respuesta (no lanza excepción), así que funciona igual en un
    Resource de Flask-RESTful que en una ruta de función. El rol se lee de la
    base (current_user.rol), no del claim "role" del token: el claim queda
    desactualizado hasta que expira si cambian el rol de alguien.

    Si alguien olvida @jwt_required(), current_user lanza un error (500) en
    lugar de dejar pasar la petición: falla cerrado.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user.estado:
            return {"error": "Usuario inactivo"}, 401
        if not es_admin(current_user):
            return {"error": "Se requieren permisos de administrador"}, 403
        return fn(*args, **kwargs)
    return wrapper
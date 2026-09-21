from functools import wraps

from flask_jwt_extended import current_user

ROL_ADMINISTRADOR = "Administrador"
ROLES_ADMIN = {ROL_ADMINISTRADOR}


def es_admin(usuario):
    return bool(usuario) and bool(usuario.rol) and usuario.rol.nombre in ROLES_ADMIN


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user.estado:
            return {"error": "Usuario inactivo"}, 401
        if not es_admin(current_user):
            return {"error": "Se requieren permisos de administrador"}, 403
        return fn(*args, **kwargs)
    return wrapper
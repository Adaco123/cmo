"""Rutas del módulo usuarios: registro, login, perfil y administración."""
import re

from flask import request
from flask_restful import Api, Resource
from flask_jwt_extended import create_access_token, jwt_required, current_user

from app.usuarios.models import Usuario
from app.roles.models import Rol
from app.usuarios.schemas import UsuarioSchema
from app.usuarios.api_v1_0 import usuarios_bp

usuarios_schema = UsuarioSchema()
api = Api(usuarios_bp)

CORREO_REGEX = r'^[^@\s]+@[^@\s]+\.[^@\s]+$'
ROLES_ADMIN = {"Propietario", "Administrador"}


def es_admin(usuario):
    return bool(usuario.rol) and usuario.rol.nombre in ROLES_ADMIN


class Registro_Resource(Resource):
    def post(self):
        try:
            data = request.get_json()
            campos_requeridos = ['usuario', 'correo', 'contra', 'rol_id']
            if not data or not all(k in data for k in campos_requeridos):
                return {'error': 'Faltan datos'}, 400

            nombre_usuario = data['usuario'].strip()
            correo = data['correo'].strip()
            contra = data['contra']

            if not contra or not isinstance(contra, str) or contra.strip() == '':
                return {'error': 'La contraseña es requerida y no puede estar vacía'}, 400
            if len(contra) < 8:
                return {'error': 'La contraseña debe tener al menos 8 caracteres'}, 400
            if not re.match(r'^[A-Za-z0-9_.]{3,50}$', nombre_usuario):
                return {'error': 'El usuario debe tener entre 3 y 50 caracteres alfanuméricos'}, 400
            if not re.match(CORREO_REGEX, correo):
                return {'error': 'El correo no tiene un formato válido'}, 400

            rol_id = int(data['rol_id'])
            if not Rol.get_by_id(rol_id):
                return {'error': 'El rol indicado no existe'}, 404

            if Usuario.get_by_correo(correo):
                return {'error': f'El correo {correo} ya está siendo utilizado por otro usuario'}, 409
            if Usuario.get_by_usuario(nombre_usuario):
                return {'error': f'El usuario {nombre_usuario} ya existe'}, 409

            user = Usuario(usuario=nombre_usuario, correo=correo, rol_id=rol_id, estado=True)
            user.set_password(contra)
            user.save()

            return {'message': 'Usuario creado exitosamente', 'user': usuarios_schema.dump(user)}, 201
        except Exception as e:
            return {'error': f'Error interno del servidor: {str(e)}'}, 500


class Login_Resource(Resource):
    def post(self):
        try:
            data = request.get_json()
            campos_requeridos = ['correo', 'contra']
            if not data or not all(k in data for k in campos_requeridos):
                return {'error': 'Faltan datos'}, 400

            correo = data['correo'].strip()
            contra = data['contra']

            user = Usuario.get_by_correo(correo)

            if user is not None and user.estado and user.check_password(contra):
                rol = user.rol.nombre if user.rol else None
                token = create_access_token(identity=str(user.id), additional_claims={"role": rol})
                return {
                    'access_token': token,
                    'message': 'Iniciado correctamente',
                    'rol': rol,
                    'usuario': user.usuario,
                    'id': user.id,
                }, 200
            return {'error': 'Credenciales incorrectas o usuario inactivo'}, 401
        except Exception as e:
            return {'error': f'Error interno del servidor: {str(e)}'}, 500


class Usuario_Resource(Resource):
    @jwt_required()
    def get(self):
        try:
            user = current_user
            if not user:
                return {'error': 'Usuario no encontrado'}, 404
            return {'user': usuarios_schema.dump(user)}, 200
        except Exception as e:
            return {'error': f'Error interno del servidor: {str(e)}'}, 500


class UsuarioEdit_Resource(Resource):
    @jwt_required()
    def put(self, usuario_id):
        try:
            data = request.get_json()
            user = Usuario.get_by_id(usuario_id)
            if not user:
                return {'error': 'Usuario no encontrado'}, 404

            current_user_obj = current_user
            if current_user_obj.id != user.id and not es_admin(current_user_obj):
                return {'error': 'No tienes permisos para editar este usuario'}, 403

            if 'usuario' in data:
                nombre_usuario = data['usuario'].strip()
                if not re.match(r'^[A-Za-z0-9_.]{3,50}$', nombre_usuario):
                    return {'error': 'El usuario debe tener entre 3 y 50 caracteres alfanuméricos'}, 400
                existente = Usuario.get_by_usuario(nombre_usuario)
                if existente and existente.id != user.id:
                    return {'error': f'El usuario {nombre_usuario} ya existe'}, 409
                user.usuario = nombre_usuario

            if 'correo' in data:
                correo = data['correo'].strip()
                if not re.match(CORREO_REGEX, correo):
                    return {'error': 'El correo no tiene un formato válido'}, 400
                existente = Usuario.get_by_correo(correo)
                if existente and existente.id != user.id:
                    return {'error': f'El correo {correo} ya está en uso'}, 409
                user.correo = correo

            if 'rol_id' in data:
                if not es_admin(current_user_obj):
                    return {'error': 'Solo administradores pueden cambiar el rol'}, 403
                rol_id = int(data['rol_id'])
                if not Rol.get_by_id(rol_id):
                    return {'error': 'Rol no encontrado'}, 404
                user.rol_id = rol_id

            if 'estado' in data:
                if not es_admin(current_user_obj):
                    return {'error': 'Solo administradores pueden cambiar el estado'}, 403
                estado = data['estado']
                if not isinstance(estado, bool):
                    return {'error': 'estado debe ser true o false'}, 400
                user.estado = estado

            user.save()
            return {'message': 'Usuario actualizado exitosamente', 'user': usuarios_schema.dump(user)}, 200
        except Exception as e:
            return {'error': f'Error interno del servidor: {str(e)}'}, 500


class CambiarContrasena_Resource(Resource):
    @jwt_required()
    def post(self):
        try:
            data = request.get_json()
            campos_requeridos = ['contra_actual', 'contra_nueva']
            if not data or not all(k in data for k in campos_requeridos):
                return {'error': 'Faltan datos: contra_actual y contra_nueva'}, 400

            contra_actual = data['contra_actual']
            contra_nueva = data['contra_nueva']

            if not contra_nueva or contra_nueva.strip() == '':
                return {'error': 'La nueva contraseña no puede estar vacía'}, 400
            if len(contra_nueva) < 8:
                return {'error': 'La nueva contraseña debe tener al menos 8 caracteres'}, 400

            user = current_user
            if not user.check_password(contra_actual):
                return {'error': 'La contraseña actual es incorrecta'}, 401

            user.set_password(contra_nueva)
            user.save()
            return {'message': 'Contraseña cambiada exitosamente'}, 200
        except Exception as e:
            return {'error': f'Error interno del servidor: {str(e)}'}, 500


class UsuariosList_Resource(Resource):
    @jwt_required()
    def get(self):
        try:
            query = Usuario.query
            rol_nombre = request.args.get('rol')
            estado_str = request.args.get('estado')

            if rol_nombre:
                rol = Rol.query.filter_by(nombre=rol_nombre).first()
                if not rol:
                    return {'error': f'Rol {rol_nombre} no encontrado'}, 404
                query = query.filter_by(rol_id=rol.id)

            if estado_str is not None:
                if estado_str.lower() == 'true':
                    estado = True
                elif estado_str.lower() == 'false':
                    estado = False
                else:
                    return {'error': 'estado debe ser true o false'}, 400
                query = query.filter_by(estado=estado)

            usuarios = query.all()
            return {'users': usuarios_schema.dump(usuarios, many=True)}, 200
        except Exception as e:
            return {'error': f'Error interno del servidor: {str(e)}'}, 500


api.add_resource(Registro_Resource, '/registrar')
api.add_resource(Login_Resource, '/login')
api.add_resource(Usuario_Resource, '/me')
api.add_resource(UsuarioEdit_Resource, '/<int:usuario_id>')
api.add_resource(CambiarContrasena_Resource, '/cambiar-contrasena')
api.add_resource(UsuariosList_Resource, '/')

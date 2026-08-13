"""Modelo(s) del módulo usuarios."""
from werkzeug.security import generate_password_hash, check_password_hash

from app.db import db, BaseModelMixin


class Usuario(db.Model, BaseModelMixin):
    __tablename__ = "usuarios"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    usuario = db.Column(db.String(50), nullable=False, unique=True)
    contrasena_hash = db.Column(db.String(255), nullable=False)
    correo = db.Column(db.String(150), nullable=False, unique=True)
    rol_id = db.Column(db.SmallInteger, db.ForeignKey('roles.id'), nullable=False)
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    rol = db.relationship("Rol", back_populates="usuarios")
    empleado = db.relationship("Empleado", back_populates="usuario", uselist=False)
    archivos_subidos = db.relationship("Archivo", back_populates="subido_por")
    cobros_registrados = db.relationship("Cobro", back_populates="usuario")
    pagos_registrados = db.relationship("Pago", back_populates="usuario")
    auditorias = db.relationship("Auditoria", back_populates="usuario")

    def __repr__(self):
        return f"<Usuario id={self.id}>"

    # -- Helpers de autenticación -------------------------------------

    def set_password(self, contra):
        self.contrasena_hash = generate_password_hash(contra)

    def check_password(self, contra):
        return check_password_hash(self.contrasena_hash, contra)

    @classmethod
    def get_by_correo(cls, correo):
        return cls.query.filter_by(correo=correo).first()

    @classmethod
    def get_by_usuario(cls, usuario):
        return cls.query.filter_by(usuario=usuario).first()

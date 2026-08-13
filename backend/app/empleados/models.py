"""Modelo(s) del módulo empleados."""
from app.db import db, BaseModelMixin


class Empleado(db.Model, BaseModelMixin):
    __tablename__ = "empleados"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    usuario_id = db.Column(db.BigInteger, db.ForeignKey('usuarios.id', ondelete='RESTRICT'), nullable=False, unique=True)
    consultorio_id = db.Column(db.SmallInteger, db.ForeignKey('consultorios.id'), nullable=True)
    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    documento = db.Column(db.String(30), nullable=False, unique=True)
    telefono = db.Column(db.String(30))
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    consultorio = db.relationship("Consultorio", back_populates="empleados")
    usuario = db.relationship("Usuario", back_populates="empleado")
    medico = db.relationship("Medico", back_populates="empleado", uselist=False)

    def __repr__(self):
        return f"<Empleado id={self.id}>"

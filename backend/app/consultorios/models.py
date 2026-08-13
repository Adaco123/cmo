"""Modelo(s) del módulo consultorios."""
from app.db import db, BaseModelMixin


class Consultorio(db.Model, BaseModelMixin):
    __tablename__ = "consultorios"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(150), nullable=False)
    direccion = db.Column(db.String(200))
    telefono = db.Column(db.String(30))
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    empleados = db.relationship("Empleado", back_populates="consultorio")
    pacientes = db.relationship("Paciente", back_populates="consultorio")
    citas = db.relationship("Cita", back_populates="consultorio")

    def __repr__(self):
        return f"<Consultorio id={self.id}>"

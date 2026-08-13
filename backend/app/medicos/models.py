"""Modelo(s) del módulo medicos."""
from app.db import db, BaseModelMixin

class Medico(db.Model, BaseModelMixin):
    __tablename__ = "medicos"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    empleado_id = db.Column(db.BigInteger, db.ForeignKey('empleados.id', ondelete='RESTRICT'), nullable=False, unique=True)
    especialidad = db.Column(db.String(100), nullable=False)
    matricula_profesional = db.Column(db.String(50), nullable=False, unique=True)
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    empleado = db.relationship("Empleado", back_populates="medico")
    pacientes_referidos = db.relationship("Paciente", back_populates="medico_referente")
    citas = db.relationship("Cita", back_populates="medico")
    consultas = db.relationship("Consulta", back_populates="medico")
    informes = db.relationship("InformeEcografia", back_populates="medico")
    recetas = db.relationship("Receta", back_populates="medico")
    seguimientos_control = db.relationship("SeguimientoControl", back_populates="medico")  # 👈 nuevo

    def __repr__(self):
        return f"<Medico id={self.id}>"

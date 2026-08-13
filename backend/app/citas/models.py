"""Modelo(s) del módulo citas."""
from app.db import db, BaseModelMixin


class Cita(db.Model, BaseModelMixin):
    __tablename__ = "citas"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    paciente_id = db.Column(db.BigInteger, db.ForeignKey('pacientes.id'), nullable=False)
    medico_id = db.Column(db.BigInteger, db.ForeignKey('medicos.id'), nullable=False)
    consultorio_id = db.Column(db.SmallInteger, db.ForeignKey('consultorios.id'), nullable=True)
    fecha = db.Column(db.Date, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fin = db.Column(db.Time, nullable=True)
    motivo = db.Column(db.String(200))
    estado_id = db.Column(db.SmallInteger, db.ForeignKey('estados_cita.id'), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    paciente = db.relationship("Paciente", back_populates="citas")
    medico = db.relationship("Medico", back_populates="citas")
    consultorio = db.relationship("Consultorio", back_populates="citas")
    estado = db.relationship("EstadoCita", back_populates="citas")
    consulta = db.relationship("Consulta", back_populates="cita", uselist=False)

    def __repr__(self):
        return f"<Cita id={self.id}>"

"""Modelo(s) del módulo consultas."""
from app.db import db, BaseModelMixin


class Consulta(db.Model, BaseModelMixin):
    __tablename__ = "consultas"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    cita_id = db.Column(db.BigInteger, db.ForeignKey('citas.id'), nullable=True, unique=True)
    paciente_id = db.Column(db.BigInteger, db.ForeignKey('pacientes.id'), nullable=False)
    medico_id = db.Column(db.BigInteger, db.ForeignKey('medicos.id'), nullable=False)
    fecha = db.Column(db.Date, nullable=False)
    hora = db.Column(db.Time, nullable=False)
    motivo = db.Column(db.String(200))
    diagnostico = db.Column(db.String(500))
    
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    cita = db.relationship("Cita", back_populates="consulta")
    paciente = db.relationship("Paciente", back_populates="consultas")
    medico = db.relationship("Medico", back_populates="consultas")
    registro_clinico = db.relationship("RegistroClinico", back_populates="consulta", uselist=False)
    cobro = db.relationship("Cobro", back_populates="consulta", uselist=False)
    #recetas = db.relationship("Receta", back_populates="consulta")
    def __repr__(self):
        return f"<Consulta id={self.id}>"

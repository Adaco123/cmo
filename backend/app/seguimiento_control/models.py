"""Modelo del módulo historial_clinico: SeguimientoControl."""
from app.db import db, BaseModelMixin


class SeguimientoControl(db.Model, BaseModelMixin):
    __tablename__ = "seguimientos_control"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    registro_clinico_id = db.Column(
        db.BigInteger,
        db.ForeignKey("registros_clinicos.id"),
        nullable=False,
    )
    medico_id = db.Column(
        db.BigInteger,
        db.ForeignKey("medicos.id"),
        nullable=False,
    )

    fecha = db.Column(db.Date, server_default=db.func.current_date(), nullable=False)
    evolucion = db.Column(db.Text, nullable=False)          # "sigue con fiebre", "mejoró", "sanó"
    proxima_fecha_control = db.Column(db.Date)               # NULL = ya no debe volver
    hora_inicio = db.Column(db.Time, nullable=True)           # hora del control agendado (opcional)
    hora_fin = db.Column(db.Time, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )


    registro_clinico = db.relationship("RegistroClinico", back_populates="seguimientos_control")
    medico = db.relationship("Medico", back_populates="seguimientos_control")
    recetas = db.relationship("Receta", back_populates="seguimiento_control")

    @property
    def paciente_id(self):
        if not self.registro_clinico or not self.registro_clinico.consulta:
            return None
        return self.registro_clinico.consulta.paciente_id

    def __repr__(self):
        return f"<SeguimientoControl id={self.id} registro_clinico_id={self.registro_clinico_id} fecha={self.fecha}>"
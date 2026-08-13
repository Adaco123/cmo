"""Modelo(s) del módulo origenes_paciente."""
from app.db import db, BaseModelMixin


class OrigenPaciente(db.Model, BaseModelMixin):
    __tablename__ = "origenes_paciente"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(50), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    pacientes = db.relationship("Paciente", back_populates="origen")

    def __repr__(self):
        return f"<OrigenPaciente id={self.id}>"

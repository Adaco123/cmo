"""Modelo(s) del módulo estados_cita."""
from app.db import db, BaseModelMixin


class EstadoCita(db.Model, BaseModelMixin):
    __tablename__ = "estados_cita"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(30), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    citas = db.relationship("Cita", back_populates="estado")

    def __repr__(self):
        return f"<EstadoCita id={self.id}>"

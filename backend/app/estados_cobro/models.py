"""Modelo(s) del módulo estados_cobro."""
from app.db import db, BaseModelMixin


class EstadoCobro(db.Model, BaseModelMixin):
    __tablename__ = "estados_cobro"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(30), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    cobros = db.relationship("Cobro", back_populates="estado")

    def __repr__(self):
        return f"<EstadoCobro id={self.id}>"

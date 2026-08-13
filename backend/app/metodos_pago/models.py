"""Modelo(s) del módulo metodos_pago."""
from app.db import db, BaseModelMixin


class MetodoPago(db.Model, BaseModelMixin):
    __tablename__ = "metodos_pago"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(30), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    pagos = db.relationship("Pago", back_populates="metodo_pago")

    def __repr__(self):
        return f"<MetodoPago id={self.id}>"

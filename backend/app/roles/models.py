"""Modelo(s) del módulo roles."""
from app.db import db, BaseModelMixin


class Rol(db.Model, BaseModelMixin):
    __tablename__ = "roles"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(50), nullable=False, unique=True)
    descripcion = db.Column(db.String(200))

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    usuarios = db.relationship("Usuario", back_populates="rol")

    def __repr__(self):
        return f"<Rol id={self.id}>"

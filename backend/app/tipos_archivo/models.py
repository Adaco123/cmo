"""Modelo(s) del módulo tipos_archivo."""
from app.db import db, BaseModelMixin


class TipoArchivo(db.Model, BaseModelMixin):
    __tablename__ = "tipos_archivo"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(30), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    archivos = db.relationship("Archivo", back_populates="tipo_archivo")

    def __repr__(self):
        return f"<TipoArchivo id={self.id}>"

"""Modelo(s) del módulo categorias_modelo."""
from app.db import db, BaseModelMixin


class CategoriaModelo(db.Model, BaseModelMixin):
    __tablename__ = "categorias_modelo"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(80), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    modelos = db.relationship("ModeloInforme", back_populates="categoria")

    def __repr__(self):
        return f"<CategoriaModelo id={self.id}>"

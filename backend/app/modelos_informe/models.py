"""Modelo(s) del módulo modelos_informe."""
from app.db import db, BaseModelMixin


class ModeloInforme(db.Model, BaseModelMixin):
    __tablename__ = "modelos_informe"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    nombre = db.Column(db.String(150), nullable=False)
    categoria_id = db.Column(db.SmallInteger, db.ForeignKey('categorias_modelo.id'), nullable=False)
    descripcion = db.Column(db.String(300))
    contenido_base = db.Column(db.Text, nullable=False)
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    categoria = db.relationship("CategoriaModelo", back_populates="modelos")
    informes = db.relationship("InformeEcografia", back_populates="modelo")

    def __repr__(self):
        return f"<ModeloInforme id={self.id}>"

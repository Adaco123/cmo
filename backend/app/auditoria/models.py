"""Modelo(s) del módulo auditoria."""
from app.db import db, BaseModelMixin
from sqlalchemy.dialects.postgresql import JSONB

class Auditoria(db.Model, BaseModelMixin):
    __tablename__ = "auditoria"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    usuario_id = db.Column(db.BigInteger, db.ForeignKey('usuarios.id'), nullable=True)
    accion = db.Column(db.String(50), nullable=False)
    tabla_afectada = db.Column(db.String(60), nullable=False)
    registro_id = db.Column(db.BigInteger)
    detalle = db.Column(JSONB)
    fecha_hora = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    usuario = db.relationship("Usuario", back_populates="auditorias")

    def __repr__(self):
        return f"<Auditoria id={self.id}>"

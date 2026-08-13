"""Modelo(s) del módulo pagos."""
from datetime import datetime, timezone, timedelta

from sqlalchemy import func

from app.db import db, BaseModelMixin

BOLIVIA_TZ = timezone(timedelta(hours=-4))


class Pago(db.Model, BaseModelMixin):
    __tablename__ = "pagos"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    cobro_id = db.Column(db.BigInteger, db.ForeignKey('cobros.id'), nullable=False)
    monto = db.Column(db.Numeric(12, 2), nullable=False)
    metodo_pago_id = db.Column(db.SmallInteger, db.ForeignKey('metodos_pago.id'), nullable=False)
    numero_recibo_pago = db.Column(db.String(30), nullable=False, unique=True)
    referencia = db.Column(db.String(100))
    usuario_id = db.Column(db.BigInteger, db.ForeignKey('usuarios.id'), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    cobro = db.relationship("Cobro", back_populates="pagos")
    metodo_pago = db.relationship("MetodoPago", back_populates="pagos")
    usuario = db.relationship("Usuario", back_populates="pagos_registrados")

    def __repr__(self):
        return f"<Pago id={self.id}>"

    @classmethod
    def resumen_pagos_hoy_bolivia(cls):
        """Retorna (total, cantidad) de pagos registrados hoy, hora boliviana."""
        ahora_bo = datetime.now(BOLIVIA_TZ)
        inicio_dia_bo = ahora_bo.replace(hour=0, minute=0, second=0, microsecond=0)
        fin_dia_bo = inicio_dia_bo + timedelta(days=1)

        total, cantidad = (
            db.session.query(
                func.coalesce(func.sum(cls.monto), 0),
                func.count(cls.id),
            )
            .filter(cls.created_at >= inicio_dia_bo, cls.created_at < fin_dia_bo)
            .first()
        )
        return total, cantidad
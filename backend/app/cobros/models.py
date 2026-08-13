"""Modelo(s) del módulo cobros."""
from app.db import db, BaseModelMixin


class Cobro(db.Model, BaseModelMixin):
    __tablename__ = "cobros"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    consulta_id = db.Column(db.BigInteger, db.ForeignKey('consultas.id'), nullable=False, unique=True)
    
    monto = db.Column(db.Numeric(12, 2), nullable=False)
    descuento = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    monto_final = db.Column(db.Numeric(12, 2), nullable=False)
    estado_id = db.Column(db.SmallInteger, db.ForeignKey('estados_cobro.id'), nullable=False)
    numero_recibo = db.Column(db.String(30), nullable=False, unique=True)
    fecha = db.Column(db.Date, nullable=False, server_default=db.func.current_date())
    usuario_id = db.Column(db.BigInteger, db.ForeignKey('usuarios.id'), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    consulta = db.relationship("Consulta", back_populates="cobro")
    
    estado = db.relationship("EstadoCobro", back_populates="cobros")
    usuario = db.relationship("Usuario", back_populates="cobros_registrados")
    pagos = db.relationship("Pago", back_populates="cobro")

    def __repr__(self):
        return f"<Cobro id={self.id}>"
    
"""Modelo(s) del módulo informes_ecografia."""
from app.db import db, BaseModelMixin


class InformeEcografia(db.Model, BaseModelMixin):
    __tablename__ = "informes_ecografia"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    registro_clinico_id = db.Column(db.BigInteger, db.ForeignKey('registros_clinicos.id'), nullable=False)
    modelo_id = db.Column(db.BigInteger, db.ForeignKey('modelos_informe.id'), nullable=True)
    medico_id = db.Column(db.BigInteger, db.ForeignKey('medicos.id'), nullable=False)
    fecha = db.Column(db.Date, nullable=False, server_default=db.func.current_date())
    contenido_final = db.Column(db.Text, nullable=False)
    conclusion = db.Column(db.Text)
    observaciones = db.Column(db.Text)
    pdf_ruta = db.Column(db.String(300))
    estado = db.Column(db.String(20), nullable=False, default='BORRADOR')
    fecha_cierre = db.Column(db.DateTime(timezone=True), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    registro_clinico = db.relationship("RegistroClinico", back_populates="informes")
    modelo = db.relationship("ModeloInforme", back_populates="informes")
    medico = db.relationship("Medico", back_populates="informes")
    archivos = db.relationship("Archivo", back_populates="informe")

    def __repr__(self):
        return f"<InformeEcografia id={self.id}>"

"""Modelo(s) del módulo examenes_complementarios."""
from app.db import db, BaseModelMixin


class CategoriaExamen(db.Model, BaseModelMixin):
    __tablename__ = "categorias_examen"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)
    nombre = db.Column(db.String(60), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    examenes = db.relationship("ExamenComplementario", back_populates="categoria")

    def __repr__(self):
        return f"<CategoriaExamen id={self.id} nombre={self.nombre}>"


class ExamenComplementario(db.Model, BaseModelMixin):
    __tablename__ = "examenes_complementarios"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    registro_clinico_id = db.Column(db.BigInteger, db.ForeignKey('registros_clinicos.id'), nullable=False)
    categoria_id = db.Column(db.SmallInteger, db.ForeignKey('categorias_examen.id'), nullable=False)

    nombre_examen = db.Column(db.String(200), nullable=False)
    resultado = db.Column(db.Text)
    observaciones = db.Column(db.String(300))
    fecha = db.Column(db.Date, nullable=False, server_default=db.func.current_date())

    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    registro_clinico = db.relationship("RegistroClinico", back_populates="examenes_complementarios")
    categoria = db.relationship("CategoriaExamen", back_populates="examenes")
    archivos = db.relationship("Archivo", back_populates="examen_complementario", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ExamenComplementario id={self.id} nombre_examen={self.nombre_examen}>"
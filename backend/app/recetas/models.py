"""Modelo(s) del módulo recetas."""
from app.db import db, BaseModelMixin


class TipoReceta(db.Model, BaseModelMixin):
    __tablename__ = "tipos_receta"

    id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)
    nombre = db.Column(db.String(40), nullable=False, unique=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    recetas = db.relationship("Receta", back_populates="tipo_receta")

    def __repr__(self):
        return f"<TipoReceta id={self.id} nombre={self.nombre}>"


class Receta(db.Model, BaseModelMixin):
    __tablename__ = "recetas"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    registro_clinico_id = db.Column(db.BigInteger, db.ForeignKey('registros_clinicos.id'), nullable=False)
    tipo_receta_id = db.Column(db.SmallInteger, db.ForeignKey('tipos_receta.id'), nullable=False)
    medico_id = db.Column(db.BigInteger, db.ForeignKey('medicos.id'), nullable=False)
    seguimiento_control_id = db.Column(
        db.BigInteger, db.ForeignKey('seguimientos_control.id'), nullable=True
    ) 
    fecha = db.Column(db.Date, nullable=False, server_default=db.func.current_date())
    indicaciones_generales = db.Column(db.Text)
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now(),
        onupdate=db.func.now(), nullable=False,
    )
    seguimiento_control = db.relationship("SeguimientoControl", back_populates="recetas")
    archivos = db.relationship("Archivo", back_populates="receta")
    registro_clinico = db.relationship("RegistroClinico", back_populates="recetas")
    tipo_receta = db.relationship("TipoReceta", back_populates="recetas")
    medico = db.relationship("Medico", back_populates="recetas")

    medicamentos = db.relationship("RecetaMedicamento", back_populates="receta", cascade="all, delete-orphan")
    formulas_magistrales = db.relationship("RecetaFormulaMagistral", back_populates="receta", cascade="all, delete-orphan")
    examenes = db.relationship("RecetaExamen", back_populates="receta", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Receta id={self.id} registro_clinico_id={self.registro_clinico_id}>"
class RecetaMedicamento(db.Model, BaseModelMixin):
    __tablename__ = "receta_medicamentos"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    receta_id = db.Column(db.BigInteger, db.ForeignKey('recetas.id'), nullable=False)

    medicamento = db.Column(db.String(200), nullable=False)
    dosis = db.Column(db.String(60), nullable=False)
    via_administracion = db.Column(db.String(40))
    frecuencia = db.Column(db.String(60), nullable=False)
    duracion = db.Column(db.String(60))
    cantidad = db.Column(db.String(30))
    indicaciones = db.Column(db.String(300))

    receta = db.relationship("Receta", back_populates="medicamentos")

    def __repr__(self):
        return f"<RecetaMedicamento id={self.id} medicamento={self.medicamento}>"


class RecetaFormulaMagistral(db.Model, BaseModelMixin):
    __tablename__ = "receta_formulas_magistrales"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    receta_id = db.Column(db.BigInteger, db.ForeignKey('recetas.id'), nullable=False)

    nombre_formula = db.Column(db.String(200), nullable=False)
    ingredientes = db.Column(db.Text, nullable=False)
    forma_farmaceutica = db.Column(db.String(60))
    cantidad_preparar = db.Column(db.String(60))
    via_administracion = db.Column(db.String(40))
    indicaciones = db.Column(db.String(300))

    receta = db.relationship("Receta", back_populates="formulas_magistrales")

    def __repr__(self):
        return f"<RecetaFormulaMagistral id={self.id} nombre_formula={self.nombre_formula}>"


class RecetaExamen(db.Model, BaseModelMixin):
    __tablename__ = "receta_examenes"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    receta_id = db.Column(db.BigInteger, db.ForeignKey('recetas.id'), nullable=False)

    nombre_examen = db.Column(db.String(200), nullable=False)
    tipo_examen = db.Column(db.String(30), nullable=False)  # laboratorio / imagenologia / otro
    urgencia = db.Column(db.String(20), nullable=False, default="Rutina")
    indicaciones_previas = db.Column(db.String(300))

    receta = db.relationship("Receta", back_populates="examenes")

    def __repr__(self):
        return f"<RecetaExamen id={self.id} nombre_examen={self.nombre_examen}>"
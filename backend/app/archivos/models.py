"""Modelo(s) del módulo archivos."""
from app.db import db, BaseModelMixin


class Archivo(db.Model, BaseModelMixin):
    __tablename__ = "archivos"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    registro_clinico_id = db.Column(db.BigInteger, db.ForeignKey('registros_clinicos.id'), nullable=True)
    informe_id = db.Column(db.BigInteger, db.ForeignKey('informes_ecografia.id'), nullable=True)
    tipo_archivo_id = db.Column(db.SmallInteger, db.ForeignKey('tipos_archivo.id'), nullable=False)
    nombre_archivo = db.Column(db.String(255), nullable=False)
    ruta_almacenamiento = db.Column(db.String(500), nullable=False)
    tamano_bytes = db.Column(db.BigInteger)
    subido_por_usuario_id = db.Column(db.BigInteger, db.ForeignKey('usuarios.id'), nullable=False)
    receta_id = db.Column(db.BigInteger, db.ForeignKey('recetas.id'), nullable=True)
    receta = db.relationship("Receta",back_populates="archivos")
    paciente_id = db.Column(db.BigInteger, db.ForeignKey('pacientes.id'), nullable=True)
    paciente = db.relationship("Paciente", back_populates="archivos")
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    registro_clinico = db.relationship("RegistroClinico", back_populates="archivos")
    informe = db.relationship("InformeEcografia", back_populates="archivos")
    tipo_archivo = db.relationship("TipoArchivo", back_populates="archivos")
    subido_por = db.relationship("Usuario", back_populates="archivos_subidos")
    examen_complementario_id = db.Column(db.BigInteger, db.ForeignKey('examenes_complementarios.id'), nullable=True)
    examen_complementario = db.relationship("ExamenComplementario", back_populates="archivos")
    def __repr__(self):
        return f"<Archivo id={self.id}>"
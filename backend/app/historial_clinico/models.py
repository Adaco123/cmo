"""Modelos del módulo historial_clinico: HistoriaClinica y RegistroClinico."""
from app.db import db, BaseModelMixin


class HistoriaClinica(db.Model, BaseModelMixin):
    __tablename__ = "historias_clinicas"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    paciente_id = db.Column(
        db.BigInteger,
        db.ForeignKey("pacientes.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    fecha_apertura = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    paciente = db.relationship("Paciente", back_populates="historia_clinica")

    registros_clinicos = db.relationship(
        "RegistroClinico",
        back_populates="historia_clinica",
    )

    def __repr__(self):
        return f"<HistoriaClinica id={self.id} paciente_id={self.paciente_id}>"


class RegistroClinico(db.Model, BaseModelMixin):
    __tablename__ = "registros_clinicos"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    historia_clinica_id = db.Column(
        db.BigInteger, db.ForeignKey("historias_clinicas.id"), nullable=False
    )
    consulta_id = db.Column(
        db.BigInteger,
        db.ForeignKey("consultas.id"),
        nullable=False,
        unique=True,   # relación 1:1 real con Consulta
    )

    # --- Signos vitales ------------------------------------------------
    presion_arterial = db.Column(db.String(15), nullable=False)
    frecuencia_cardiaca = db.Column(db.SmallInteger, nullable=False)
    frecuencia_respiratoria = db.Column(db.SmallInteger, nullable=False)
    saturacion_oxigeno = db.Column(db.SmallInteger, nullable=False)   # SpO2, en % (ej. 98)
    glicemia = db.Column(db.Numeric(5, 1), nullable=False) 
    temperatura = db.Column(db.Numeric(4, 1), nullable=False)
    peso = db.Column(db.Numeric(5, 2), nullable=False)
    talla = db.Column(db.Numeric(4, 2), nullable=False)
    hallazgos_ecograficos=db.Column(db.String(200),nullable=False)
    # --- Lo exclusivo del registro clínico (no de la consulta) -----------
    enfermedad_actual = db.Column(db.Text)
    examen_fisico = db.Column(db.Text)
    tratamiento = db.Column(db.Text)
    consulta_control = db.Column(db.Text)
    alergias = db.Column(db.Text)
    observaciones = db.Column(db.Text)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    historia_clinica = db.relationship("HistoriaClinica", back_populates="registros_clinicos")
    consulta = db.relationship("Consulta", back_populates="registro_clinico")
    informes = db.relationship("InformeEcografia", back_populates="registro_clinico")

    # Restaurado: tu modelo real de Archivo (el que me pasaste) SÍ tiene
    # registro_clinico_id y back_populates="archivos" apuntando aquí.
    # Sin esta línea, SQLAlchemy va a fallar al armar el mapper con un
    # InvalidRequestError por back_populates sin su contraparte.
    archivos = db.relationship("Archivo", back_populates="registro_clinico")
    recetas = db.relationship("Receta", back_populates="registro_clinico")
    # Nuevo: módulo de exámenes complementarios que acabamos de diseñar.
    examenes_complementarios = db.relationship(
        "ExamenComplementario", back_populates="registro_clinico"
    )
    seguimientos_control = db.relationship(
        "SeguimientoControl", back_populates="registro_clinico", order_by="SeguimientoControl.fecha"
    )
    # --- Propiedades de solo lectura, sin duplicar datos ------------------
    @property
    def paciente(self):
        return self.historia_clinica.paciente if self.historia_clinica else None

    @property
    def medico(self):
        return self.consulta.medico if self.consulta else None

    @property
    def fecha(self):
        return self.consulta.fecha if self.consulta else None

    @property
    def hora(self):
        return self.consulta.hora if self.consulta else None

    @property
    def diagnostico(self):
        return self.consulta.diagnostico if self.consulta else None

    @property
    def motivo_consulta(self):
        return self.consulta.motivo if self.consulta else None

    def __repr__(self):
        return f"<RegistroClinico id={self.id} historia_clinica_id={self.historia_clinica_id}>"


class SeguimientoControl(db.Model, BaseModelMixin):
    __tablename__ = "seguimientos_control"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    registro_clinico_id = db.Column(
        db.BigInteger,
        db.ForeignKey("registros_clinicos.id"),
        nullable=False,
    )
    medico_id = db.Column(
        db.BigInteger,
        db.ForeignKey("medicos.id"),
        nullable=False,
    )

    fecha = db.Column(db.Date, server_default=db.func.current_date(), nullable=False)
    evolucion = db.Column(db.Text, nullable=False)          # "sigue con fiebre", "mejoró", "sanó"
    proxima_fecha_control = db.Column(db.Date)               # NULL = ya no debe volver
    hora_inicio = db.Column(db.Time, nullable=True)           # hora del control agendado (opcional)
    hora_fin = db.Column(db.Time, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    registro_clinico = db.relationship("RegistroClinico", back_populates="seguimientos_control")
    medico = db.relationship("Medico", back_populates="seguimientos_control")
    recetas = db.relationship("Receta", back_populates="seguimiento_control")

    @property
    def paciente_id(self):
        if not self.registro_clinico or not self.registro_clinico.consulta:
            return None
        return self.registro_clinico.consulta.paciente_id

    def __repr__(self):
        return f"<SeguimientoControl id={self.id} registro_clinico_id={self.registro_clinico_id} fecha={self.fecha}>"
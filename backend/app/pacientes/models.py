"""Modelo(s) del módulo pacientes."""
import re
from datetime import date, datetime, time

from app.db import db, BaseModelMixin


class Paciente(db.Model, BaseModelMixin):
    __tablename__ = "pacientes"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    documento = db.Column(db.String(30), nullable=False, unique=True)
    fecha_nacimiento = db.Column(db.Date, nullable=False)
    sexo = db.Column(db.String(1), nullable=False)
    direccion = db.Column(db.String(200))
    telefono = db.Column(db.String(30))
    correo = db.Column(db.String(150))
    
    origen_id = db.Column(db.SmallInteger, db.ForeignKey('origenes_paciente.id'), nullable=False)
    medico_referente_id = db.Column(db.BigInteger, db.ForeignKey('medicos.id'), nullable=True)
    medico_referente_externo = db.Column(db.String(150))
    consultorio_id = db.Column(db.SmallInteger, db.ForeignKey('consultorios.id'), nullable=True)
    estado = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )

    origen = db.relationship("OrigenPaciente", back_populates="pacientes")
    medico_referente = db.relationship("Medico", back_populates="pacientes_referidos")
    consultorio = db.relationship("Consultorio", back_populates="pacientes")
    historia_clinica = db.relationship("HistoriaClinica", back_populates="paciente", uselist=False)
    citas = db.relationship("Cita", back_populates="paciente")
    consultas = db.relationship("Consulta", back_populates="paciente")

    def obtener_alergias(self):
        """Retorna una lista con las alergias registradas para este paciente."""
        if not self.historia_clinica:
            return []

        alergias = []
        for registro in self.historia_clinica.registros_clinicos or []:
            if not registro.alergias:
                continue

            texto = str(registro.alergias).strip()
            if not texto or texto in {"—", "-", "N/A", "NA", "No registra"}:
                continue

            partes = re.split(r"[,;\n]+", texto)
            for parte in partes:
                valor = parte.strip()
                if valor and valor not in alergias:
                    alergias.append(valor)

        return alergias

    def obtener_ultimo_diagnostico(self):
        """Retorna el diagnóstico más reciente del paciente."""
        consultas = [
            consulta
            for consulta in self.consultas or []
            if consulta.diagnostico and str(consulta.diagnostico).strip()
        ]

        if not consultas:
            return None

        consulta_mas_reciente = max(
            consultas,
            key=lambda consulta: (
                consulta.created_at or datetime.min,
                consulta.id or 0,
            ),
        )
        return str(consulta_mas_reciente.diagnostico).strip()

    def __repr__(self):
        return f"<Paciente id={self.id}>"

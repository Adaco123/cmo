"""Reglas de disponibilidad de horario de un médico.

Antes esta lógica estaba duplicada en app/citas/api_v1_0/resources.py y
app/historial_clinico/api_v1_0/resources.py, cada una con su propio nombre
de función y su propia firma. Se centraliza aquí porque "¿este médico ya
tiene algo agendado a esa hora?" es una regla de negocio única que ambos
módulos consumen, no algo que le pertenezca a citas ni a historial_clinico.
"""
from app.citas.models import Cita
from app.seguimiento_control.models import SeguimientoControl


def existe_choque_con_cita(medico_id, fecha, hora_inicio, hora_fin, excluir_id=None):
    """True si el médico ya tiene una cita que se solapa con ese rango horario."""
    query = Cita.query.filter(
        Cita.medico_id == medico_id,
        Cita.fecha == fecha,
        Cita.hora_inicio < hora_fin,
        Cita.hora_fin > hora_inicio,
    )
    if excluir_id is not None:
        query = query.filter(Cita.id != excluir_id)
    return query.first() is not None


def existe_choque_con_seguimiento(medico_id, fecha, hora_inicio, hora_fin, excluir_id=None):
    """True si el médico ya tiene un control de seguimiento que se solapa con ese rango horario."""
    query = SeguimientoControl.query.filter(
        SeguimientoControl.medico_id == medico_id,
        SeguimientoControl.proxima_fecha_control == fecha,
        SeguimientoControl.hora_inicio.isnot(None),
        SeguimientoControl.hora_fin.isnot(None),
        SeguimientoControl.hora_inicio < hora_fin,
        SeguimientoControl.hora_fin > hora_inicio,
    )
    if excluir_id is not None:
        query = query.filter(SeguimientoControl.id != excluir_id)
    return query.first() is not None
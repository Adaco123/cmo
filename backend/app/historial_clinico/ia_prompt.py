"""Arma el prompt que se envía a la IA a partir de un RegistroClinico.

Privacidad: NO se envía nombre, apellidos, documento (CI), teléfono, correo ni
dirección. Solo edad, sexo y datos clínicos. Como los campos de texto libre
(observaciones, evolución, etc.) a veces traen el nombre del paciente, se
reemplaza cualquier aparición de sus nombres/apellidos por "[PACIENTE]".
"""
import re
from datetime import date

SYSTEM_PROMPT = (
    "Eres un asistente de apoyo a la decisión clínica para un médico en un "
    "consultorio. Recibes los datos de un registro clínico (sin datos de "
    "identificación del paciente). Responde SIEMPRE en español, de forma "
    "concisa y ordenada, con estas secciones:\n"
    "1. Resumen del caso (2-3 líneas).\n"
    "2. Impresión diagnóstica / diagnósticos diferenciales a considerar.\n"
    "3. Opciones de tratamiento sugeridas (medidas no farmacológicas y "
    "farmacológicas, con dosis habituales en adulto o pediátrica según la "
    "edad, vía y duración).\n"
    "4. Alertas: alergias, contraindicaciones, interacciones con lo ya "
    "recetado, y signos vitales o resultados fuera de rango.\n"
    "5. Estudios complementarios o seguimiento que podrían faltar.\n"
    "6. Señales de alarma para derivar o reconsultar.\n"
    "Formato: texto plano, sin markdown (no uses **, #, ni tablas); usa "
    "los números de sección y guiones simples para las listas.\n"
    "Reglas: no inventes datos que no estén en el registro; si falta "
    "información importante dilo explícitamente; respeta las alergias "
    "registradas; usa nombres genéricos de medicamentos; recuerda que eres "
    "una ayuda y que la decisión final es del médico tratante."
)


def _limpiar(valor) -> str:
    if valor is None:
        return ""
    return str(valor).strip()


def _edad(fecha_nacimiento, referencia: date | None) -> str:
    if not fecha_nacimiento:
        return "no registrada"
    ref = referencia or date.today()
    anios = ref.year - fecha_nacimiento.year - (
        (ref.month, ref.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )
    if anios >= 2:
        return f"{anios} años"
    meses = (ref.year - fecha_nacimiento.year) * 12 + ref.month - fecha_nacimiento.month
    if ref.day < fecha_nacimiento.day:
        meses -= 1
    return f"{max(meses, 0)} meses"


def _sexo(codigo) -> str:
    return {"M": "masculino", "F": "femenino"}.get(_limpiar(codigo).upper(), "no especificado")


def _construir_anonimizador(paciente):
    """Devuelve una función que tacha el nombre del paciente en cualquier texto."""
    palabras = set()
    if paciente:
        for campo in (paciente.nombres, paciente.apellidos):
            for palabra in _limpiar(campo).split():
                if len(palabra) >= 3:
                    palabras.add(palabra)
    if not palabras:
        return lambda texto: texto
    patron = re.compile(
        r"\b(" + "|".join(re.escape(p) for p in sorted(palabras, key=len, reverse=True)) + r")\b",
        re.IGNORECASE,
    )
    return lambda texto: patron.sub("[PACIENTE]", texto)


def _linea(etiqueta: str, valor, anon) -> str | None:
    texto = _limpiar(valor)
    return f"- {etiqueta}: {anon(texto)}" if texto else None


def _bloque(titulo: str, lineas: list) -> str:
    cuerpo = [l for l in lineas if l]
    return f"{titulo}\n" + "\n".join(cuerpo) if cuerpo else ""


def construir_prompt_registro(registro, examenes, recetas, seguimientos) -> str:
    """Texto de usuario con TODO el contenido clínico de UN registro.

    `examenes`, `recetas` y `seguimientos` deben venir ya filtrados a los
    activos (estado=True), igual que en RegistroClinicoDetalleCompleto_Resource.
    """
    paciente = registro.paciente
    anon = _construir_anonimizador(paciente)
    partes = []

    partes.append(_bloque("DATOS DEL PACIENTE", [
        f"- Edad: {_edad(paciente.fecha_nacimiento if paciente else None, registro.fecha)}",
        f"- Sexo: {_sexo(paciente.sexo if paciente else None)}",
        _linea("Alergias registradas", registro.alergias, anon),
    ]))

    partes.append(_bloque("CONSULTA", [
        _linea("Fecha", registro.fecha, anon),
        _linea("Motivo de consulta", registro.motivo_consulta, anon),
        _linea("Diagnóstico registrado por el médico", registro.diagnostico, anon),
        _linea("Enfermedad actual", registro.enfermedad_actual, anon),
        _linea("Examen físico", registro.examen_fisico, anon),
        _linea("Hallazgos ecográficos", registro.hallazgos_ecograficos, anon),
        _linea("Observaciones", registro.observaciones, anon),
    ]))

    peso, talla = registro.peso, registro.talla
    imc = None
    try:
        if peso and talla and float(talla) > 0:
            imc = round(float(peso) / (float(talla) ** 2), 1)
    except (TypeError, ValueError):
        imc = None
    partes.append(_bloque("SIGNOS VITALES", [
        _linea("Presión arterial", registro.presion_arterial, anon),
        _linea("Frecuencia cardíaca (lpm)", registro.frecuencia_cardiaca, anon),
        _linea("Frecuencia respiratoria (rpm)", registro.frecuencia_respiratoria, anon),
        _linea("Saturación de oxígeno (%)", registro.saturacion_oxigeno, anon),
        _linea("Temperatura (°C)", registro.temperatura, anon),
        _linea("Glicemia (mg/dL)", registro.glicemia, anon),
        _linea("Peso (kg)", peso, anon),
        _linea("Talla (m)", talla, anon),
        _linea("IMC", imc, anon),
    ]))

    partes.append(_bloque("TRATAMIENTO YA INDICADO POR EL MÉDICO (texto libre)", [
        _linea("Tratamiento", registro.tratamiento, anon),
        _linea("Nota de control", registro.consulta_control, anon),
    ]))

    # ---- Recetas (consulta inicial y seguimientos) ----
    lineas_recetas = []
    for r in recetas:
        origen = "seguimiento" if r.seguimiento_control_id else "consulta inicial"
        cab = f"- Receta de {origen} ({_limpiar(r.fecha)})"
        if r.indicaciones_generales:
            cab += f": {anon(_limpiar(r.indicaciones_generales))}"
        lineas_recetas.append(cab)
        for m in r.medicamentos:
            detalle = " · ".join(
                x for x in (m.dosis, m.via_administracion, m.frecuencia, m.duracion) if _limpiar(x)
            )
            lineas_recetas.append(f"    • {_limpiar(m.medicamento)}: {anon(detalle)}")
        for f in r.formulas_magistrales:
            lineas_recetas.append(
                f"    • Fórmula magistral {_limpiar(f.nombre_formula)}: {anon(_limpiar(f.ingredientes))}"
            )
        for e in r.examenes:
            lineas_recetas.append(f"    • Examen solicitado: {_limpiar(e.nombre_examen)}")
    partes.append(_bloque("RECETAS", lineas_recetas))

    # ---- Exámenes complementarios ----
    lineas_ex = []
    for ex in examenes:
        res = anon(_limpiar(ex.resultado)) or "sin resultado"
        obs = anon(_limpiar(ex.observaciones))
        txt = f"- {_limpiar(ex.nombre_examen)} ({_limpiar(ex.fecha)}): {res}"
        if obs:
            txt += f" | Observaciones: {obs}"
        lineas_ex.append(txt)
    partes.append(_bloque(
        "EXÁMENES COMPLEMENTARIOS (solo texto; las imágenes/PDF no se envían)", lineas_ex
    ))

    # ---- Seguimientos ----
    lineas_seg = [
        f"- {_limpiar(s.fecha)}: {anon(_limpiar(s.evolucion)) or 'sin evolución escrita'}"
        for s in seguimientos
    ]
    partes.append(_bloque("SEGUIMIENTOS DE CONTROL", lineas_seg))

    cuerpo = "\n\n".join(p for p in partes if p)
    return (
        cuerpo
        + "\n\nCon base en este registro, sugiere el tratamiento más adecuado "
        "siguiendo las secciones indicadas."
    )
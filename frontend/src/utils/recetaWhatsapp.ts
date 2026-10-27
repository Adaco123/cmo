import type { Receta } from '../api/recetas';

// Helpers de WhatsApp para enviar una receta (mismo patrón que Calendario.tsx).
// Compartidos por RegistroClinicoDetalle y la tarjeta de atenciones con archivos.
export function toWhatsAppNumber(telefono: string): string {
  const digits = telefono.replace(/\D/g, '');
  return digits.startsWith('591') ? digits : `591${digits}`;
}

export function buildWhatsAppUrl(telefono: string, mensaje: string): string {
  return `https://wa.me/${toWhatsAppNumber(telefono)}?text=${encodeURIComponent(mensaje)}`;
}

export function formatFechaLabel(fecha: string): string {
  const soloFecha = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] ?? fecha;
  return new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${soloFecha}T00:00:00`)
  );
}

export function mensajeReceta(nombrePaciente: string, fechaLabel: string, receta: Receta): string {
  const lineas: string[] = [`Hola ${nombrePaciente}, esta es tu receta de CMO del ${fechaLabel}:`];

  if (receta.indicaciones_generales) {
    lineas.push('', receta.indicaciones_generales);
  }

  if (receta.medicamentos.length > 0) {
    lineas.push('', '*Medicamentos*');
    receta.medicamentos.forEach((m) => {
      const detalle = [m.dosis, m.via_administracion, m.frecuencia, m.duracion].filter(Boolean).join(' · ');
      lineas.push(`- ${m.medicamento}${detalle ? ` — ${detalle}` : ''}`);
      if (m.indicaciones) lineas.push(`  ${m.indicaciones}`);
    });
  }

  if (receta.formulas_magistrales.length > 0) {
    lineas.push('', '*Fórmulas magistrales*');
    receta.formulas_magistrales.forEach((f) => {
      lineas.push(`- ${f.nombre_formula}: ${f.ingredientes}`);
      const detalle = [f.forma_farmaceutica, f.cantidad_preparar, f.via_administracion].filter(Boolean).join(' · ');
      if (detalle) lineas.push(`  ${detalle}`);
    });
  }

  if (receta.examenes.length > 0) {
    lineas.push('', '*Exámenes solicitados*');
    receta.examenes.forEach((e) => {
      lineas.push(`- ${e.nombre_examen}${e.urgencia === 'Urgente' ? ' (Urgente)' : ''}`);
    });
  }

  return lineas.join('\n');
}
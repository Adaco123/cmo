/**
 * Validación de los campos obligatorios (y del correo) de PacienteForm y
 * EditarPacienteForm. Los formularios llevan `noValidate`, así que ningún
 * aviso sale como tooltip nativo del navegador: se muestran por el toast.
 *
 * Obligatorios: nombres, apellidos, fecha de nacimiento y sexo (marcados con
 * asterisco en los formularios). El documento (CI) es OPCIONAL: un bebé, por
 * ejemplo, no tiene CI.
 *
 * Devuelve el mensaje del primer problema encontrado (en el mismo orden en
 * que aparecen los campos) o null si todo está bien.
 */
interface DatosPacienteValidables {
  nombres: string;
  apellidos: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: string;
  correo: string;
}

export function validarDatosPaciente(datos: DatosPacienteValidables): string | null {
  if (!datos.nombres.trim()) return 'Escribe los nombres del paciente.';
  if (!datos.apellidos.trim()) return 'Escribe los apellidos del paciente.';
  if (!datos.fecha_nacimiento) return 'Indica la fecha de nacimiento.';
  if (!datos.sexo) return 'Selecciona el sexo del paciente.';
  // Mismo criterio de tolerancia que el <input type="email"> nativo.
  if (datos.correo.trim() && !/^[^\s@]+@[^\s@]+$/.test(datos.correo.trim())) {
    return 'El correo electrónico no es válido.';
  }
  return null;
}
/**
 * Extrae un mensaje de error legible de una respuesta del backend.
 *
 * Antes esta lógica estaba reinventada en cada componente:
 * - VerPaciente.tsx solo miraba data.error
 * - PacienteForm.tsx además soportaba el formato de error de Marshmallow
 *   (un objeto tipo { campo: ["mensaje"] }, sin un campo "error" plano)
 *
 * Se centraliza aquí con el soporte más completo (el de PacienteForm.tsx),
 * para que cualquier componente obtenga el mismo mensaje sin importar
 * qué forma tenga el error del backend.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const data =
    err && typeof err === 'object' && 'response' in err
      ? (err as any).response?.data
      : undefined;

  const primerErrorMarshmallow =
    data && typeof data === 'object'
      ? Object.values(data).flat().find((v) => typeof v === 'string')
      : undefined;

  const backendMessage =
    data?.error || data?.msg || primerErrorMarshmallow || (err as any)?.message;

  return backendMessage || fallback;
}
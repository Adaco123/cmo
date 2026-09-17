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
interface RespuestaConData {
  response?: { data?: unknown };
}

function tieneResponseData(err: unknown): err is RespuestaConData {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  const data = tieneResponseData(err) ? err.response?.data : undefined;
  const dataObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;

  const primerErrorMarshmallow = dataObj
    ? Object.values(dataObj).flat().find((v) => typeof v === 'string')
    : undefined;

  const mensajeDelError = err instanceof Error ? err.message : undefined;

  const backendMessage =
    (typeof dataObj?.error === 'string' ? dataObj.error : undefined) ??
    (typeof dataObj?.msg === 'string' ? dataObj.msg : undefined) ??
    primerErrorMarshmallow ??
    mensajeDelError;

  return backendMessage || fallback;
}
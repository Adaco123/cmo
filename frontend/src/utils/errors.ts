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

/**
 * Busca el primer string dentro de un valor de error de Marshmallow,
 * bajando recursivamente por objetos y arrays. Antes esto solo hacía
 * `Object.values(dataObj).flat()`, que aplana un nivel de ARRAYS nomás
 * — no objetos — así que un error como
 * {"registro": {"temperatura": ["Debe estar entre 25 y 45 °C"]}}
 * (el formato que devuelven RegistroClinicoCompleto_Resource.post/put al
 * envolver err.messages bajo la clave "consulta"/"registro") nunca
 * encontraba el string real y cualquier componente que use
 * extractErrorMessage terminaba mostrando el mensaje genérico de axios
 * ("Request failed with status code 400") en vez del motivo real.
 */
function primerString(valor: unknown): string | undefined {
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = primerString(item);
      if (encontrado) return encontrado;
    }
    return undefined;
  }
  if (valor && typeof valor === 'object') {
    for (const item of Object.values(valor)) {
      const encontrado = primerString(item);
      if (encontrado) return encontrado;
    }
  }
  return undefined;
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  const data = tieneResponseData(err) ? err.response?.data : undefined;
  const dataObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;

  const primerErrorMarshmallow = dataObj ? primerString(dataObj) : undefined;

  const mensajeDelError = err instanceof Error ? err.message : undefined;

  const backendMessage =
    (typeof dataObj?.error === 'string' ? dataObj.error : undefined) ??
    (typeof dataObj?.msg === 'string' ? dataObj.msg : undefined) ??
    primerErrorMarshmallow ??
    mensajeDelError;

  return backendMessage || fallback;
}
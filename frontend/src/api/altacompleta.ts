import axios from 'axios';
import api from '../api';
import { extractErrorMessage } from '../utils/errors';

export interface Rol {
  id: number;
  nombre: string;
}

export interface Consultorio {
  id: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
}

/** Catálogo de roles. Los ids pueden cambiar entre bases: siempre buscar por `nombre`. */
export async function getRoles(): Promise<Rol[]> {
  const { data } = await api.get<Rol[]>('/api/roles/');
  return data;
}

export async function getConsultorios(): Promise<Consultorio[]> {
  const { data } = await api.get<Consultorio[]>('/api/consultorios/');
  return data;
}

export interface ConsultorioPayload {
  nombre: string;
  direccion?: string;
  telefono?: string;
}

/** POST /api/consultorios/ (solo Administrador). */
export async function crearConsultorio(payload: ConsultorioPayload): Promise<Consultorio> {
  const { data } = await api.post<Consultorio>('/api/consultorios/', payload);
  return data;
}

/**
 * Body de POST /api/medicos/alta-completa (solo Administrador): crea, en una
 * sola transacción, la cuenta (usuario), su empleado y su médico.
 */
export interface AltaCompletaPayload {
  usuario: { usuario: string; correo: string; contra: string; rol_id: number };
  empleado: {
    nombres: string;
    apellidos: string;
    documento: string;
    telefono?: string;
    consultorio_id?: number;
  };
  medico: { especialidad: string; matricula_profesional: string };
}

export interface AltaCompletaResponse {
  usuario: { id: number; usuario: string; correo: string };
  empleado: { id: number; nombres: string; apellidos: string };
  medico: { id: number; especialidad: string };
}

export async function crearAltaCompleta(payload: AltaCompletaPayload): Promise<AltaCompletaResponse> {
  const { data } = await api.post<AltaCompletaResponse>('/api/medicos/alta-completa', payload);
  return data;
}

const ETIQUETAS: Record<string, string> = {
  usuario: 'El usuario',
  correo: 'El correo',
  contra: 'La contraseña',
  rol_id: 'El rol',
  nombres: 'Los nombres',
  apellidos: 'Los apellidos',
  documento: 'El documento',
  telefono: 'El teléfono',
  consultorio_id: 'El consultorio',
  especialidad: 'La especialidad',
  matricula_profesional: 'La matrícula',
};

const TRADUCCIONES: Record<string, string> = {
  'Missing data for required field.': 'es obligatorio',
  'Field may not be null.': 'es obligatorio',
  'Not a valid email address.': 'no es válido',
  'Not a valid integer.': 'no es válido',
};

/**
 * Mensaje legible de un error de alta-completa. El backend responde de tres
 * formas: {"error": "..."} (409, 404...), {"usuario": {"correo": ["..."]}}
 * (errores de schema, agrupados por bloque) o un error de red / permisos.
 */
export function mensajeErrorAlta(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 403) return 'Tu cuenta no tiene permisos de administrador.';

    const data: unknown = err.response?.data;
    if (data && typeof data === 'object') {
      for (const bloque of Object.values(data as Record<string, unknown>)) {
        if (!bloque || typeof bloque !== 'object' || Array.isArray(bloque)) continue;
        for (const [campo, mensajes] of Object.entries(bloque as Record<string, unknown>)) {
          const mensaje = Array.isArray(mensajes) ? mensajes.find((m) => typeof m === 'string') : mensajes;
          if (typeof mensaje !== 'string') continue;
          const etiqueta = ETIQUETAS[campo] ?? campo;
          const traducido = TRADUCCIONES[mensaje];
          return traducido ? `${etiqueta} ${traducido}.` : `${etiqueta}: ${mensaje}`;
        }
      }
    }
  }
  return extractErrorMessage(err, 'No se pudo crear el usuario.');
}
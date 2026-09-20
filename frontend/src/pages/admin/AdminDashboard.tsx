import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faStethoscope, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/800.css';
import cmoLogo from '../../assets/cmo.png';
import { nombreCompleto } from '../../auth';
import { useAuth } from '../../components/AuthProvider';
import { useErrorToast } from '../../components/ErrorToastProvider';
import {
  crearAltaCompleta,
  getConsultorios,
  getRoles,
  mensajeErrorAlta,
  type Consultorio,
  type Rol,
} from '../../api/altacompleta';
import styles from './AdminDashboard.module.css';

// Mismas reglas que valida el backend (medicos/alta-completa).
const USUARIO_REGEX = /^[A-Za-z0-9_.]{3,50}$/;
const CORREO_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface FormAlta {
  usuario: string;
  correo: string;
  contra: string;
  confirmar: string;
  rolId: string;
  nombres: string;
  apellidos: string;
  documento: string;
  telefono: string;
  consultorioId: string;
  especialidad: string;
  matricula: string;
}

const FORM_VACIO: FormAlta = {
  usuario: '',
  correo: '',
  contra: '',
  confirmar: '',
  rolId: '',
  nombres: '',
  apellidos: '',
  documento: '',
  telefono: '',
  consultorioId: '',
  especialidad: '',
  matricula: '',
};

/** Primer error de validación (o null si todo está bien). Igual que el login: se avisa por toast. */
function validar(f: FormAlta): string | null {
  if (!USUARIO_REGEX.test(f.usuario.trim())) {
    return 'El usuario debe tener entre 3 y 50 caracteres: letras, números, "_" o ".".';
  }
  if (!CORREO_REGEX.test(f.correo.trim())) return 'El correo electrónico no es válido.';
  if (f.contra.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (f.contra !== f.confirmar) return 'Las contraseñas no coinciden.';
  if (!f.rolId) return 'Elige un rol.';
  if (!f.nombres.trim()) return 'Escribe los nombres.';
  if (!f.apellidos.trim()) return 'Escribe los apellidos.';
  if (!f.documento.trim()) return 'Escribe el documento (CI).';
  if (!f.especialidad.trim()) return 'Escribe la especialidad.';
  if (!f.matricula.trim()) return 'Escribe la matrícula profesional.';
  return null;
}

/** Minúsculas y sin tildes, para encontrar "Médico" aunque venga como "medico". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showError, showErrorFrom, showSuccess } = useErrorToast();

  const [form, setForm] = useState<FormAlta>(FORM_VACIO);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState<string | null>(null);

  // Catálogos para los desplegables. Los consultorios son opcionales: si no cargan, el campo queda vacío.
  useEffect(() => {
    let activo = true;

    getRoles()
      .then((lista) => {
        if (!activo) return;
        setRoles(lista);
        const medico = lista.find((r) => normalizar(r.nombre) === 'medico') ?? lista[0];
        if (medico) setForm((f) => (f.rolId ? f : { ...f, rolId: String(medico.id) }));
      })
      .catch((err) => {
        if (activo) showErrorFrom(err, 'No se pudieron cargar los roles.');
      });

    getConsultorios()
      .then((lista) => {
        if (activo) setConsultorios(lista);
      })
      .catch(() => {
        /* opcional: sin lista, el usuario se crea sin consultorio */
      });

    return () => {
      activo = false;
    };
  }, [showErrorFrom]);

  const cambiar =
    (campo: keyof FormAlta) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [campo]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;

    const error = validar(form);
    if (error) {
      showError(error);
      return;
    }

    setEnviando(true);
    setCreado(null);
    try {
      const telefono = form.telefono.trim();
      const respuesta = await crearAltaCompleta({
        usuario: {
          usuario: form.usuario.trim(),
          correo: form.correo.trim(),
          contra: form.contra,
          rol_id: Number(form.rolId),
        },
        empleado: {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          documento: form.documento.trim(),
          ...(telefono ? { telefono } : {}),
          ...(form.consultorioId ? { consultorio_id: Number(form.consultorioId) } : {}),
        },
        medico: {
          especialidad: form.especialidad.trim(),
          matricula_profesional: form.matricula.trim(),
        },
      });

      const nombre = `${respuesta.empleado.nombres} ${respuesta.empleado.apellidos}`.trim();
      setCreado(`${nombre} (usuario ${respuesta.usuario.usuario})`);
      showSuccess('Usuario creado correctamente.');
      // El aviso de arriba queda a la vista aunque se haya enviado desde el final del formulario.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Listo para cargar el siguiente: se conservan solo el rol y el consultorio elegidos.
      setForm({ ...FORM_VACIO, rolId: form.rolId, consultorioId: form.consultorioId });
    } catch (err) {
      showError(mensajeErrorAlta(err));
    } finally {
      setEnviando(false);
    }
  };

  const cerrarSesion = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src={cmoLogo} alt="CMO" />
          <div className={styles.brandName}>
            CMO
            <span>Panel de administración</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.usuario}>{nombreCompleto(user)}</span>
          <button type="button" className={styles.ghostBtn} onClick={() => navigate('/dashboard')}>
            <FontAwesomeIcon icon={faStethoscope} />
            Panel médico
          </button>
          <button type="button" className={styles.linkBtn} onClick={cerrarSesion}>
            <FontAwesomeIcon icon={faArrowRightFromBracket} />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="admin-titulo">
          <h1 id="admin-titulo" className={styles.title}>Nuevo usuario</h1>
          <p className={styles.subtitle}>
            Crea la cuenta, el empleado y el médico en un solo paso. Si algo falla, no se guarda nada.
          </p>

          {creado && (
            <p className={styles.exito} role="status">
              <FontAwesomeIcon icon={faUserPlus} /> Se creó a {creado}.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <fieldset className={styles.grupo}>
              <legend>Cuenta</legend>
              <div className={styles.field}>
                <label htmlFor="alta-usuario">Usuario</label>
                <input id="alta-usuario" autoComplete="off" value={form.usuario} onChange={cambiar('usuario')} />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-correo">Correo electrónico</label>
                <input
                  id="alta-correo"
                  type="email"
                  autoComplete="off"
                  placeholder="correo@ejemplo.com"
                  value={form.correo}
                  onChange={cambiar('correo')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-contra">Contraseña</label>
                <input
                  id="alta-contra"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={form.contra}
                  onChange={cambiar('contra')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-confirmar">Confirmar contraseña</label>
                <input
                  id="alta-confirmar"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmar}
                  onChange={cambiar('confirmar')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-rol">Rol</label>
                <select id="alta-rol" value={form.rolId} onChange={cambiar('rolId')}>
                  <option value="" disabled>Elige un rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            </fieldset>

            <fieldset className={styles.grupo}>
              <legend>Datos personales</legend>
              <div className={styles.field}>
                <label htmlFor="alta-nombres">Nombres</label>
                <input id="alta-nombres" autoComplete="off" value={form.nombres} onChange={cambiar('nombres')} />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-apellidos">Apellidos</label>
                <input id="alta-apellidos" autoComplete="off" value={form.apellidos} onChange={cambiar('apellidos')} />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-documento">Documento (CI)</label>
                <input id="alta-documento" autoComplete="off" value={form.documento} onChange={cambiar('documento')} />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-telefono">Teléfono <em>(opcional)</em></label>
                <input id="alta-telefono" type="tel" autoComplete="off" value={form.telefono} onChange={cambiar('telefono')} />
              </div>
              {consultorios.length > 0 && (
                <div className={styles.field}>
                  <label htmlFor="alta-consultorio">Consultorio <em>(opcional)</em></label>
                  <select id="alta-consultorio" value={form.consultorioId} onChange={cambiar('consultorioId')}>
                    <option value="">Sin consultorio</option>
                    {consultorios.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </fieldset>

            <fieldset className={styles.grupo}>
              <legend>Datos profesionales</legend>
              <div className={styles.field}>
                <label htmlFor="alta-especialidad">Especialidad</label>
                <input
                  id="alta-especialidad"
                  autoComplete="off"
                  value={form.especialidad}
                  onChange={cambiar('especialidad')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="alta-matricula">Matrícula profesional</label>
                <input id="alta-matricula" autoComplete="off" value={form.matricula} onChange={cambiar('matricula')} />
              </div>
            </fieldset>

            <div className={styles.actions}>
              <button type="submit" className={styles.submitBtn} disabled={enviando}>
                {enviando ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
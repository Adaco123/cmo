import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  
} from 'react';
import styles from './Examenes.module.css';
import '../../index.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlaskVial } from '@fortawesome/free-solid-svg-icons';
// Tipos
type Categoria = 'laboratorio' | 'imagenologia' | 'otros';

interface ExamenItem {
  id: number;
  nombre: string;
  observaciones: string;
  estado: boolean;
  archivos: { nombre: string; archivoObj: File }[];
  categoria: Categoria;
}

export interface ExamenPayloadItem {
  nombre_examen: string;
  resultado: string | null;
  observaciones: string | null;
  categoria_id: number;
  archivos: File[];
}

export interface ExamenesBloque {
  items: ExamenPayloadItem[];
}

export interface ExamenesPayloadSalida {
  laboratorio?: ExamenesBloque;
  imagenologia?: ExamenesBloque;
  otros?: ExamenesBloque;
}

export interface ExamenesHandle {
  /** Devuelve solo las categorías que tienen al menos un ítem. `null` si no hay nada. */
  getPayload: () => ExamenesPayloadSalida | null;
  /** Limpia todo — llamar después de un guardado exitoso. */
  reset: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contexto: {
    registro_clinico_id: number;
    medico_id: number;
    paciente_nombre: string;
    registro_numero: string;
    medico_nombre: string;
  };
  /** Notifica al padre cuántos ítems hay en total (para el badge del dock). */
  onItemsCountChange?: (count: number) => void;
}

// Catálogo de exámenes por categoría
const CATALOGOS = {
  laboratorio: [
    'Hemograma completo', 'Glicemia en ayunas', 'Perfil lipídico',
    'Examen general de orina', 'Perfil hepático', 'Perfil renal',
    'PCR (Proteína C Reactiva)', 'VSG', 'Prueba de embarazo',
    'Cultivo de orina', 'TSH', 'Coproparasitológico',
    'Tiempo de coagulación', 'Ferritina', 'Vitamina B12'
  ],
  imagenologia: [
    'Radiografía de tórax', 'Radiografía de columna',
    'Radiografía de extremidades', 'Ecografía abdominal',
    'Ecografía pélvica', 'Ecografía mamaria', 'Ecografía doppler',
    'Tomografía axial computarizada (TAC)', 'Resonancia magnética',
    'Mamografía', 'Densitometría ósea', 'Angiografía'
  ],
  otros: [
    'Electrocardiograma', 'Holter de 24h', 'Biopsia', 'Endoscopia',
    'Citología', 'Prueba de esfuerzo', 'Espirometría',
    'Audiometría', 'Campo visual', 'Dermatoscopia'
  ]
};

const CHIPS = {
  laboratorio: ['Hemograma completo', 'Glicemia en ayunas', 'Examen general de orina', 'PCR', 'Perfil lipídico', 'TSH'],
  imagenologia: ['Radiografía de tórax', 'Ecografía abdominal', 'Radiografía de columna', 'TAC', 'Resonancia magnética', 'Mamografía'],
  otros: ['Electrocardiograma', 'Biopsia', 'Endoscopia', 'Holter de 24h', 'Citología', 'Espirometría']
};

const CATEGORIA_ID: Record<Categoria, number> = {
  laboratorio: 1,
  imagenologia: 2,
  otros: 3
};

interface ToastState {
  msg: string;
  undo?: () => void;
}

const Examenes = forwardRef<ExamenesHandle, Props>(function Examenes(
  { isOpen, onClose, contexto, onItemsCountChange },
  ref
) {
  // Estado general
  const [tab, setTab] = useState<Categoria>('laboratorio');
  const [items, setItems] = useState<ExamenItem[]>([]);
  const [nextId, setNextId] = useState(1);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Referencias
  const nombreInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  /* ---------- handle expuesto al padre (getPayload / reset) ---------- */
  useImperativeHandle(ref, () => ({
    getPayload: () => {
      const payload: ExamenesPayloadSalida = {};

      (['laboratorio', 'imagenologia', 'otros'] as Categoria[]).forEach((cat) => {
        const catItems = items.filter((i) => i.categoria === cat);
        if (catItems.length) {
          payload[cat] = {
            items: catItems.map((i) => ({
              nombre_examen: i.nombre,
              resultado: null,
              observaciones: i.observaciones.trim() || null,
              categoria_id: CATEGORIA_ID[cat],
              archivos: i.archivos.map((a) => a.archivoObj),
            })),
          };
        }
      });

      return Object.keys(payload).length ? payload : null;
    },
    reset: () => {
      setItems([]);
      setNombre('');
      setObservaciones('');
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  }));

  // Notifica al padre el conteo total de ítems (para el badge del dock).
  useEffect(() => {
    onItemsCountChange?.(items.length);
  }, [items, onItemsCountChange]);

  // Enfoque al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nombreInputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Resetear formulario al cambiar pestaña
  useEffect(() => {
    setNombre('');
    setObservaciones('');
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [tab]);

  // Contar items por categoría
  const counts = {
    laboratorio: items.filter(i => i.categoria === 'laboratorio').length,
    imagenologia: items.filter(i => i.categoria === 'imagenologia').length,
    otros: items.filter(i => i.categoria === 'otros').length,
  };

  /* ---------- toast (con soporte de deshacer, igual que Receta.tsx) ---------- */
  const showToast = (msg: string, undoFn?: () => void) => {
    setToast({ msg, undo: undoFn });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Agregar examen
  const agregarExamen = useCallback(() => {
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      showToast('Ingrese el nombre del examen');
      nombreInputRef.current?.focus();
      return;
    }
    // El campo resultado ya no existe en el formulario: siempre se
    // envía null al componente padre (ver getPayload más arriba).

    const nuevo: ExamenItem = {
      id: nextId,
      nombre: trimmedNombre,
      observaciones: observaciones.trim(),
      estado: true,
      archivos: pendingFiles.map(f => ({ nombre: f.name, archivoObj: f })),
      categoria: tab
    };
    setItems(prev => [...prev, nuevo]);
    setNextId(prev => prev + 1);

    // Limpiar campos
    setNombre('');
    setObservaciones('');
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Enfocar de nuevo al nombre para agregar otro
    setTimeout(() => nombreInputRef.current?.focus(), 50);
  }, [nombre, observaciones, pendingFiles, tab, nextId]);

  // Eliminar item — igual que Receta.tsx: quita la línea y muestra un
  // toast con opción de "Deshacer" que la reinserta en su posición original.
  const eliminarItem = useCallback((id: number) => {
    setItems(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx < 0) return prev;
      const removed = prev[idx];
      const next = prev.filter(item => item.id !== id);

      showToast('Examen eliminado', () => {
        setItems(list => {
          const copy = [...list];
          copy.splice(idx, 0, removed);
          return copy;
        });
      });

      return next;
    });
  }, []);

  // Manejo de archivos
  const agregarArchivos = useCallback((files: FileList | null) => {
    if (!files) return;
    const nuevos = Array.from(files);
    setPendingFiles(prev => [...prev, ...nuevos]);
  }, []);

  const eliminarArchivo = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    uploadAreaRef.current?.classList.add(styles.drag);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    uploadAreaRef.current?.classList.remove(styles.drag);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    uploadAreaRef.current?.classList.remove(styles.drag);
    if (e.dataTransfer.files) {
      agregarArchivos(e.dataTransfer.files);
    }
  }, [agregarArchivos]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.altKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, Categoria> = { '1': 'laboratorio', '2': 'imagenologia', '3': 'otros' };
        setTab(map[e.key]);
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Renderizar chips
  const chipsDisponibles = CHIPS[tab] || [];

  // Renderizar lista de items
  const renderItemList = () => {
    if (items.length === 0) {
      return <div className={styles.ticketEmpty}>Aún no hay exámenes en esta categoría.</div>;
    }
    return items.map((item, idx) => (
      <div key={item.id} className={styles.ticketLine}>
        <div className={styles.num}>{idx + 1}</div>
        <div className={styles.body}>
          <div className={styles.t1}>
            {item.nombre}
            {item.archivos.length > 0 && (
              <span className={styles.paperclip} title={`${item.archivos.length} archivo(s)`}>
                <i className="fas fa-paperclip"></i> ×{item.archivos.length}
              </span>
            )}
          </div>
          <div className={styles.t2}>
            {item.archivos.length > 0 ? `${item.archivos.length} archivo(s) adjunto(s)` : 'Sin archivos adjuntos'}
          </div>
        </div>
        <button type="button" className={styles.rm} title="Eliminar" onClick={() => eliminarItem(item.id)}>
          <i className="fas fa-trash"></i>
        </button>
      </div>
    ));
  };

  // Renderizar miniaturas de archivos
  const renderGallery = () => {
    return pendingFiles.map((file, idx) => (
      <div key={idx} className={styles.fileThumb}>
        {file.type.startsWith('image/') ? (
          <img src={URL.createObjectURL(file)} alt="preview" />
        ) : (
          <div className={styles.docIco}><i className="fas fa-file-pdf"></i></div>
        )}
        <div className={styles.thumbName}>{file.name}</div>
        <button className={styles.rmThumb} onClick={() => eliminarArchivo(idx)}>
          <i className="fas fa-times"></i>
        </button>
      </div>
    ));
  };

  // IMPORTANTE: este return-null solo oculta el contenido renderizado.
  // El componente sigue MONTADO (sus hooks/estado siguen vivos) mientras
  // el padre lo mantenga en el árbol sin envolverlo en `isOpen && (...)`.
  // Así es como los ítems sobreviven a abrir/cerrar el drawer.
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className={styles.overlay} onClick={onClose} />

      {/* Drawer */}
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.drawerHead}>
<div className={styles.ico}><FontAwesomeIcon icon={faFlaskVial} /></div>
          <div className={styles.titles}>          
            <h3>Exámenes complementarios</h3>
            <div className={styles.ctx}>
              <span>Paciente: <b>{contexto.paciente_nombre}</b></span>
              
              <span>Médico: <b>{contexto.medico_nombre}</b></span>
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.drawerBody}>
          {/* Tabs */}
          <div className={styles.examTabs}>
            <button
              className={`${styles.examTab} ${tab === 'laboratorio' ? styles.active : ''} ${styles.tabLab}`}
              onClick={() => setTab('laboratorio')}
            >
              <i className="fas fa-flask"></i> Laboratorio <span className={styles.k}>Alt+1</span>
            </button>
            <button
              className={`${styles.examTab} ${tab === 'imagenologia' ? styles.active : ''} ${styles.tabImg}`}
              onClick={() => setTab('imagenologia')}
            >
              <i className="fas fa-x-ray"></i> Imagenología <span className={styles.k}>Alt+2</span>
            </button>
            <button
              className={`${styles.examTab} ${tab === 'otros' ? styles.active : ''} ${styles.tabOtros}`}
              onClick={() => setTab('otros')}
            >
              <i className="fas fa-microscope"></i> Otros <span className={styles.k}>Alt+3</span>
            </button>
          </div>

          {/* Chips */}
          <div className={styles.chipsLabel}>Más usados en esta categoría</div>
          <div className={styles.chips}>
            {chipsDisponibles.map(chip => (
              <button
                key={chip}
                className={styles.chipQuick}
                onClick={() => {
                  setNombre(chip);
                  nombreInputRef.current?.focus();
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Formulario */}
          <div className={styles.examForm}>
            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.full}`}>
                <label htmlFor="nombre_examen">Nombre del examen <span className={styles.required}>*</span></label>
                <input
                  ref={nombreInputRef}
                  id="nombre_examen"
                  type="text"
                  list={`dl_${tab}`}
                  autoComplete="off"
                  maxLength={200}
                  placeholder="Escriba para buscar o elija un chip de arriba…"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarExamen();
                    }
                  }}
                />
                <datalist id={`dl_${tab}`}>
                  {CATALOGOS[tab].map(n => <option key={n} value={n} />)}
                </datalist>
                <div className={styles.formHint}>
                  Puede escribir un examen que no esté en la lista si es necesario.
                </div>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.full}`}>
                <div className={styles.labelRow}>
                  <label htmlFor="observaciones_examen">Observaciones</label>
                  <span className={styles.counter}>{observaciones.length}/300</span>
                </div>
                <textarea
                  id="observaciones_examen"
                  rows={2}
                  maxLength={300}
                  placeholder="Observaciones adicionales…"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.full}`}>
                <label>Archivos adjuntos</label>
                <div className={styles.formHint} style={{ margin: '0 0 6px' }}>
                  Puede adjuntar varias imágenes a la vez — por ejemplo, todas las tomas de una misma ecografía.
                </div>
                <div
                  ref={uploadAreaRef}
                  className={styles.uploadArea}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={e => agregarArchivos(e.target.files)}
                  />
                  <label htmlFor="archivo_examen" className={styles.uploadLabel}>
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>Seleccionar o arrastrar una o varias imágenes/PDF</span>
                  </label>
                  <div className={styles.fileGallery}>
                    {renderGallery()}
                  </div>
                  <div className={styles.galleryCount}>
                    {pendingFiles.length > 0 && `${pendingFiles.length} archivo(s) listos para este examen`}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <button className={styles.btnAddExam} onClick={agregarExamen}>
                <i className="fas fa-plus"></i> Agregar examen <kbd>Enter</kbd>
              </button>
            </div>
          </div>

          {/* Lista de items (ticket) */}
          <div className={styles.ticket}>
            {renderItemList()}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default Examenes;
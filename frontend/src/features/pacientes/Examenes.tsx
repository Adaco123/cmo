import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import styles from './Examenes.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFlaskVial,
  faXRay,
  faMicroscope,
  faCloudArrowUp,
  faFilePdf,
  faPaperclip,
  faTrash,
  faPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

/* ============================================================
   Helper para combinar clases del CSS Module
   ============================================================ */
const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

// Tipos
type Categoria = 'laboratorio' | 'imagenologia' | 'otros';

interface ExamenItem {
  id: number;
  nombre: string;
  observaciones: string;
  archivos: { nombre: string; archivoObj: File }[];
  categoria: Categoria;
}

/* Un archivo pendiente guarda su object URL (solo para imágenes) UNA
   vez, al agregarlo — antes se llamaba URL.createObjectURL(file) en
   cada render de la galería, lo que creaba una URL nueva cada vez que
   el doctor tecleaba algo en "Observaciones" y nunca las liberaba
   (fuga de memoria). Ahora se crea una sola vez y se libera con
   URL.revokeObjectURL al quitar el archivo, cambiar de pestaña,
   guardar o desmontar el componente. */
interface PendingFile {
  file: File;
  url: string | null;
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

const TAB_META: Record<Categoria, { label: string; icon: typeof faFlaskVial; className: string }> = {
  laboratorio: { label: 'Laboratorio', icon: faFlaskVial, className: 'tabLab' },
  imagenologia: { label: 'Imagenología', icon: faXRay, className: 'tabImg' },
  otros: { label: 'Otros', icon: faMicroscope, className: 'tabOtros' },
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
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [shakeNombre, setShakeNombre] = useState(false);

  // Referencias
  const nombreInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  // Espejo de pendingFiles para poder liberar sus object URLs al
  // desmontar el componente (el cleanup de un efecto con deps [] solo
  // ve el valor que tenía la primera vez, por eso el ref).
  const pendingFilesRef = useRef<PendingFile[]>([]);
  useEffect(() => { pendingFilesRef.current = pendingFiles; }, [pendingFiles]);
  useEffect(() => () => {
    pendingFilesRef.current.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
  }, []);

  const limpiarPendingFiles = useCallback(() => {
    setPendingFiles((prev) => {
      prev.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
      return [];
    });
  }, []);

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
      limpiarPendingFiles();
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    limpiarPendingFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Contar items por categoría
  const counts = {
    laboratorio: items.filter(i => i.categoria === 'laboratorio').length,
    imagenologia: items.filter(i => i.categoria === 'imagenologia').length,
    otros: items.filter(i => i.categoria === 'otros').length,
  };

  /* ---------- toast (con soporte de deshacer) ---------- */
  const showToast = (msg: string, undoFn?: () => void) => {
    setToast({ msg, undo: undoFn });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Agregar examen — si falta el nombre, se agita el campo y se le da
  // foco en vez de interrumpir con un toast (igual que Receta.tsx).
  const agregarExamen = useCallback(() => {
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      setShakeNombre(true);
      setTimeout(() => setShakeNombre(false), 400);
      nombreInputRef.current?.focus();
      return;
    }

    const nuevo: ExamenItem = {
      id: nextId,
      nombre: trimmedNombre,
      observaciones: observaciones.trim(),
      archivos: pendingFiles.map(p => ({ nombre: p.file.name, archivoObj: p.file })),
      categoria: tab
    };
    setItems(prev => [...prev, nuevo]);
    setNextId(prev => prev + 1);

    // Limpiar campos
    setNombre('');
    setObservaciones('');
    limpiarPendingFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Enfocar de nuevo al nombre para agregar otro
    setTimeout(() => nombreInputRef.current?.focus(), 50);
  }, [nombre, observaciones, pendingFiles, tab, nextId, limpiarPendingFiles]);

  // Eliminar item — quita la línea y muestra un toast con "Deshacer"
  // que la reinserta en su posición original.
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

  // Deshace el último examen agregado (el de mayor id), sin importar
  // en qué categoría haya quedado — atajo Ctrl+Z.
  const undoLast = useCallback(() => {
    setItems(prev => {
      if (!prev.length) return prev;
      let maxIdx = 0;
      for (let i = 1; i < prev.length; i++) if (prev[i].id > prev[maxIdx].id) maxIdx = i;
      const removed = prev[maxIdx];
      const next = prev.filter((_, i) => i !== maxIdx);

      showToast('Examen eliminado', () => {
        setItems(list => {
          const copy = [...list];
          copy.splice(maxIdx, 0, removed);
          return copy;
        });
      });

      return next;
    });
  }, []);

  // Manejo de archivos
  const agregarArchivos = useCallback((files: FileList | null) => {
    if (!files) return;
    const nuevos: PendingFile[] = Array.from(files).map((f) => ({
      file: f,
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setPendingFiles(prev => [...prev, ...nuevos]);
  }, []);

  const eliminarArchivo = useCallback((index: number) => {
    setPendingFiles(prev => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Abrir el explorador de archivos al hacer click en cualquier parte del área de subida
  const handleUploadAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.rmThumb}`)) return;
    fileInputRef.current?.click();
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
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        const enUnCampo = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
        if (!enUnCampo) { e.preventDefault(); undoLast(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, undoLast]);

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
                <FontAwesomeIcon icon={faPaperclip} /> ×{item.archivos.length}
              </span>
            )}
          </div>
          <div className={styles.t2}>
            {item.archivos.length > 0 ? `${item.archivos.length} archivo(s) adjunto(s)` : 'Sin archivos adjuntos'}
          </div>
        </div>
        <button type="button" className={styles.rm} title="Eliminar" onClick={() => eliminarItem(item.id)}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    ));
  };

  // Renderizar miniaturas de archivos pendientes
  const renderGallery = () => {
    return pendingFiles.map((p, idx) => (
      <div key={idx} className={styles.fileThumb}>
        {p.url ? (
          <img src={p.url} alt="preview" />
        ) : (
          <div className={styles.docIco}><FontAwesomeIcon icon={faFilePdf} /></div>
        )}
        <div className={styles.thumbName}>{p.file.name}</div>
        <button
          type="button"
          className={styles.rmThumb}
          onClick={(e) => {
            e.stopPropagation();
            eliminarArchivo(idx);
          }}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    ));
  };

  // IMPORTANTE: este return-null solo oculta el contenido renderizado.
  // El componente sigue MONTADO (sus hooks/estado siguen vivos) mientras
  // el padre lo mantenga en el árbol sin envolverlo en `isOpen && (...)`.
  if (!isOpen) return null;

  return (
    <div className={styles.examenesWidget}>
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
          <button type="button" className={styles.drawerClose} onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.drawerBody}>
          {/* ================= Categoría: tabs + chips + lista ================= */}
          <div className={styles.panel}>
            <div className={styles.examTabs}>
              {(Object.keys(TAB_META) as Categoria[]).map((cat, i) => {
                const meta = TAB_META[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    className={cx(styles.examTab, styles[meta.className], tab === cat && styles.active)}
                    onClick={() => setTab(cat)}
                  >
                    <FontAwesomeIcon icon={meta.icon} /> {meta.label}
                    {counts[cat] > 0 && <span className={styles.count}>{counts[cat]}</span>}
                    <span className={styles.k}>Alt+{i + 1}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.chipsLabel}>Más usados en esta categoría</div>
            <div className={styles.chips}>
              {chipsDisponibles.map(chip => (
                <button
                  key={chip}
                  type="button"
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

            <div className={styles.ticket}>
              {renderItemList()}
            </div>
          </div>

          {/* ================= Formulario para agregar un examen ================= */}
          <div className={styles.panel}>
            <div className={styles.formRow}>
              <div className={cx(styles.formGroup, styles.full)}>
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
                  className={cx(shakeNombre && styles.shakeField)}
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
              <div className={cx(styles.formGroup, styles.full)}>
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
              <div className={cx(styles.formGroup, styles.full)}>
                <label>Archivos adjuntos</label>
                <div className={styles.formHint} style={{ margin: '0 0 6px' }}>
                  Puede adjuntar varias imágenes a la vez — por ejemplo, todas las tomas de una misma ecografía.
                </div>
                <div
                  ref={uploadAreaRef}
                  className={styles.uploadArea}
                  onClick={handleUploadAreaClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    id="archivo_examen"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={e => agregarArchivos(e.target.files)}
                  />
                  <div className={styles.uploadLabel}>
                    <FontAwesomeIcon icon={faCloudArrowUp} />
                    <span>Seleccionar o arrastrar una o varias imágenes/PDF</span>
                  </div>
                  {pendingFiles.length > 0 && (
                    <div className={styles.fileGallery}>
                      {renderGallery()}
                    </div>
                  )}
                  <div className={styles.galleryCount}>
                    {pendingFiles.length > 0 && `${pendingFiles.length} archivo(s) listos para este examen`}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.btnAddExam} onClick={agregarExamen}>
                <FontAwesomeIcon icon={faPlus} /> Agregar examen <kbd>Enter</kbd>
              </button>
              <span className={styles.hintUndo}><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer último</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              type="button"
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
    </div>
  );
});

export default Examenes;
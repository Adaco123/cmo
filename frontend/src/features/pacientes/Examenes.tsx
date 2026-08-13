import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Examenes.module.css';

// Tipos
type Categoria = 'laboratorio' | 'imagenologia' | 'otros';

interface ExamenItem {
  id: number;
  nombre: string;
  resultado: string;
  observaciones: string;
  estado: boolean;
  archivos: { nombre: string; archivoObj: File }[];
  categoria: Categoria;
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
  onSave?: (items: ExamenItem[]) => void;
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

const Examenes: React.FC<Props> = ({ isOpen, onClose, contexto, onSave }) => {
  // Estado general
  const [tab, setTab] = useState<Categoria>('laboratorio');
  const [items, setItems] = useState<ExamenItem[]>([]);
  const [nextId, setNextId] = useState(1);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [resultado, setResultado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Referencias
  const nombreInputRef = useRef<HTMLInputElement>(null);
  const resultadoInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    if (isOpen && !startTime) {
      setStartTime(Date.now());
    }
    if (!isOpen) {
      setStartTime(null);
    }
  }, [isOpen, startTime]);

  const [timerText, setTimerText] = useState('0:00');
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setTimerText(`${m}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Enfoque al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nombreInputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Resetear formulario al cambiar pestaña
  useEffect(() => {
    setNombre('');
    setResultado('');
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

  // Agregar examen
  const agregarExamen = useCallback(() => {
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      setToastMessage('Ingrese el nombre del examen');
      nombreInputRef.current?.focus();
      return;
    }
    if (!resultado.trim() && pendingFiles.length === 0) {
      setToastMessage('Se necesita un resultado o al menos un archivo adjunto');
      resultadoInputRef.current?.focus();
      return;
    }

    const nuevo: ExamenItem = {
      id: nextId,
      nombre: trimmedNombre,
      resultado: resultado.trim(),
      observaciones: observaciones.trim(),
      estado: true,
      archivos: pendingFiles.map(f => ({ nombre: f.name, archivoObj: f })),
      categoria: tab
    };
    setItems(prev => [...prev, nuevo]);
    setNextId(prev => prev + 1);
    setLastAdded(trimmedNombre);

    // Limpiar campos (excepto nombre para rapidez)
    setResultado('');
    setObservaciones('');
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Enfocar de nuevo al nombre para agregar otro
    setTimeout(() => nombreInputRef.current?.focus(), 50);
  }, [nombre, resultado, observaciones, pendingFiles, tab, nextId]);

  // Duplicar último
  const duplicarUltimo = useCallback(() => {
    if (lastAdded) {
      setNombre(lastAdded);
      nombreInputRef.current?.focus();
      setToastMessage('Nombre del último examen copiado');
    }
  }, [lastAdded]);

  // Eliminar item
  const eliminarItem = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
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

  // Guardar (llama a onSave con los items)
  const guardarExamenes = useCallback(() => {
    if (items.length === 0) {
      setToastMessage('Agrega al menos un examen antes de guardar');
      return;
    }
    if (onSave) {
      onSave(items);
    }
    onClose();
  }, [items, onSave, onClose]);

  // Toast (auto‑cierre)
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        guardarExamenes();
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, guardarExamenes]);

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
            {item.resultado ? item.resultado.substring(0, 50) : 'Solo archivo adjunto'}
          </div>
        </div>
        <div className={styles.resultBadge}>Con resultado</div>
        <button className={styles.rm} onClick={() => eliminarItem(item.id)}>
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

  // Determinar clase del timer
  let timerClass = styles.timerPill;
  if (startTime) {
    const secs = Math.floor((Date.now() - startTime) / 1000);
    if (secs >= 90) timerClass = `${styles.timerPill} ${styles.red}`;
    else if (secs >= 45) timerClass = `${styles.timerPill} ${styles.amber}`;
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className={styles.overlay} onClick={onClose} />

      {/* Drawer */}
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.drawerHead}>
          <div className={styles.ico}><i className="fas fa-flask"></i></div>
          <div className={styles.titles}>
            <h3>Exámenes complementarios</h3>
            <p>Registre estudios realizados previamente o solicitados como apoyo al diagnóstico.</p>
            <div className={styles.ctx}>
              <span>Paciente: <b>{contexto.paciente_nombre}</b></span>
              <span>Registro clínico: <b>{contexto.registro_numero}</b></span>
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
                      resultadoInputRef.current?.focus();
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
                <label htmlFor="resultado_examen">Resultado <span className={styles.required}>*</span></label>
                <textarea
                  ref={resultadoInputRef}
                  id="resultado_examen"
                  rows={3}
                  placeholder="Ingrese el resultado (puede dictarlo con el micrófono del teclado)… o deje vacío si va a adjuntar un archivo con el resultado"
                  value={resultado}
                  onChange={e => setResultado(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      agregarExamen();
                    }
                  }}
                />
                <div className={styles.formHint}>
                  Se necesita resultado o al menos un archivo adjunto — este registro es para exámenes ya realizados.
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
              <button className={styles.btnDup} onClick={duplicarUltimo} disabled={!lastAdded}>
                <i className="fas fa-clone"></i> Repetir último
              </button>
            </div>
          </div>

          {/* Lista de items (ticket) */}
          <div className={styles.ticket}>
            {renderItemList()}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.drawerFoot}>
          <div className={timerClass}>
            <span className={styles.dot}></span>
            <span>{timerText}</span>
          </div>
          <div className={styles.countSummary}>
            <span><b>{counts.laboratorio}</b> laboratorio</span>
            <span><b>{counts.imagenologia}</b> imagenología</span>
            <span><b>{counts.otros}</b> otros</span>
          </div>
          <div className={styles.footActions}>
            <button className={styles.btnGhost} onClick={() => window.print()}>
              <i className="fas fa-print"></i> Imprimir
            </button>
            <button className={styles.btnSaveModern} onClick={guardarExamenes}>
              <i className="fas fa-signature"></i> Guardar exámenes <kbd>Ctrl+Enter</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className={styles.toast}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>Cerrar</button>
        </div>
      )}
    </>
  );
};

export default Examenes;
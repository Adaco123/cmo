import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import styles from "./Receta.module.css";
import RecetaImprimir from "../../assets/mosol.png"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileMedical,
  faFlaskVial,
  faMortarPestle,
  faNotesMedical,
  faPills,
  faPlus,
  faPrescriptionBottle,
  faTrash,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

/* ============================================================
   Helper para combinar clases del CSS Module
   ============================================================ */
const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

/* ============================================================
   Tipos
   ============================================================ */

type Tab = "medicamentos" | "examenes" | "formulas";

interface DBItem {
  n: string;
  s: string;
}

export interface RecetaBloque<T> {
  indicaciones_generales: string | null;
  items: T[];
}

export interface RecetaPayloadSalida {
  medicamentos?: RecetaBloque<{
    medicamento: string; dosis: string; via_administracion: string | null;
    frecuencia: string; duracion: string | null; cantidad: string | null; indicaciones: string | null;
  }>[];
  examenes?: RecetaBloque<{
    nombre_examen: string; tipo_examen: string; urgencia: string; indicaciones_previas: string | null;
  }>[];
  formulas?: RecetaBloque<{
    nombre_formula: string; ingredientes: string; forma_farmaceutica: string | null;
    cantidad_preparar: string | null; via_administracion: string | null; indicaciones: string | null;
  }>[];
}

export interface RecetaHandle {
  /** Devuelve solo los bloques que tienen al menos un ítem. `null` si no hay nada. */
  getPayload: () => RecetaPayloadSalida | null;
  /** Limpia todo — llamar después de un guardado exitoso. */
  reset: () => void;
}

interface MedItem {
  id: number;
  grupo: number;
  nombre: string;
  dosis: string;
  via: string;
  frecuencia: string;
  duracion: string;
  horario: string[] | null;
  raw: string;
}

interface ExamItem {
  id: number;
  grupo: number;
  nombre: string;
  urgencia: "urgente" | "normal";
  raw: string;
}

interface FormItem {
  id: number;
  grupo: number;
  nombre: string;
  ingredientes: string;
  via: string;
  freqDur: string;
  raw: string;
}

type AnyItem = MedItem | ExamItem | FormItem;

interface ToastState {
  msg: string;
  undo?: () => void;
}

/* ============================================================
   Datos estáticos
   ============================================================ */

const MED_DB: DBItem[] = [
  { n: "Paracetamol", s: "Paracetamol 500mg VO c/8h x5d" },
  { n: "Ibuprofeno", s: "Ibuprofeno 400mg VO c/8h x5d" },
  { n: "Amoxicilina", s: "Amoxicilina 500mg VO c/8h x7d" },
  { n: "Amoxicilina/Clavulánico", s: "Amoxicilina/Clavulánico 875/125mg VO c/12h x7d" },
  { n: "Omeprazol", s: "Omeprazol 20mg VO c/24h x14d" },
  { n: "Loratadina", s: "Loratadina 10mg VO c/24h x7d" },
  { n: "Metformina", s: "Metformina 850mg VO c/12h continuo" },
  { n: "Losartán", s: "Losartán 50mg VO c/24h continuo" },
  { n: "Diclofenaco", s: "Diclofenaco 50mg VO c/8h x3d" },
  { n: "Azitromicina", s: "Azitromicina 500mg VO c/24h x3d" },
  { n: "Ciprofloxacino", s: "Ciprofloxacino 500mg VO c/12h x7d" },
  { n: "Salbutamol inhalador", s: "Salbutamol inhalador 2puff c/6h SOS" },
  { n: "Dexametasona", s: "Dexametasona 4mg IM dosis única" },
  { n: "Ranitidina", s: "Ranitidina 150mg VO c/12h x10d" },
  { n: "Ácido fólico", s: "Ácido fólico 5mg VO c/24h x30d" },
  { n: "Complejo B", s: "Complejo B 1amp IM c/24h x5d" },
  { n: "Cetirizina", s: "Cetirizina 10mg VO c/24h x10d" },
  { n: "Metoclopramida", s: "Metoclopramida 10mg VO c/8h x3d" },
];
const MED_CHIPS = ["Diclofenaco", "Azitromicina", "Complejo B"];

const EXAM_DB: DBItem[] = [
  { n: "Hemograma completo", s: "Hemograma completo" },
  { n: "Glicemia en ayunas", s: "Glicemia en ayunas" },
  { n: "Perfil lipídico", s: "Perfil lipídico" },
  { n: "Examen general de orina", s: "Examen general de orina" },
  { n: "Perfil hepático", s: "Perfil hepático" },
  { n: "Perfil renal", s: "Perfil renal" },
  { n: "Radiografía de tórax", s: "Radiografía de tórax" },
  { n: "Electrocardiograma", s: "Electrocardiograma" },
  { n: "Ecografía abdominal", s: "Ecografía abdominal" },
  { n: "PCR (Proteína C Reactiva)", s: "PCR (Proteína C Reactiva)" },
  { n: "VSG", s: "VSG" },
  { n: "Prueba de embarazo", s: "Prueba de embarazo" },
  { n: "Cultivo de orina", s: "Cultivo de orina" },
  { n: "TSH", s: "TSH" },
  { n: "Coproparasitológico", s: "Coproparasitológico" },
];
const EXAM_CHIPS = ["Hemograma completo", "Glicemia en ayunas", "Examen general de orina", "Radiografía de tórax", "Perfil lipídico", "Electrocardiograma", "Ecografía abdominal", "PCR (Proteína C Reactiva)"];

const FORM_DB: DBItem[] = [
  { n: "Crema Betametasona + Ác. Salicílico", s: "Crema Betametasona 0.1% + Ácido salicílico 3% — vehículo c.s.p. 30g | tópico | c/12h x10d" },
  { n: "Solución para nebulizar", s: "Solución para nebulizar: Salbutamol + Bromuro de ipratropio — c.s.p. 4ml | inhalatoria | c/6h x3d" },
  { n: "Jarabe pediátrico compuesto", s: "Jarabe pediátrico: Paracetamol + Clorfenamina — c.s.p. 100ml | VO | c/8h x5d" },
  { n: "Loción capilar compuesta", s: "Loción capilar: Minoxidil 5% + Finasteride 0.1% — c.s.p. 60ml | tópico | c/24h" },
];
const FORM_CHIPS = FORM_DB.map((f) => f.n);

const DB: Record<Tab, DBItem[]> = { medicamentos: MED_DB, examenes: EXAM_DB, formulas: FORM_DB };
const CHIPS: Record<Tab, string[]> = { medicamentos: MED_CHIPS, examenes: EXAM_CHIPS, formulas: FORM_CHIPS };
const PLACEHOLDER: Record<Tab, string> = {
  medicamentos: "Paracetamol 500 c/8h x5d VO",
  examenes: "Hemograma completo, urgente",
  formulas: "Crema betametasona 0.1% + ác. salicílico 3% c.s.p 30g, tópico c/12h x10d",
};
const TITLES: Record<Tab, string> = { medicamentos: "Medicamentos", examenes: "Exámenes", formulas: "Fórmulas magistrales" };
const TIPO_ID: Record<Tab, number> = { medicamentos: 1, examenes: 2, formulas: 3 };

const CLINICA = { nombre: "Centro Médico Oruro", direccion: "Av. 6 de Agosto · Oruro, Bolivia" };

/* ============================================================
   Helpers de parseo
   ============================================================ */

function scheduleFromFrequency(frecuencia: string): string[] | null {
  if (!frecuencia) return null;
  const m = frecuencia.match(/cada (\d+) horas/i);
  if (!m) return null;
  const interval = parseInt(m[1], 10);
  if (!interval || interval <= 0 || interval > 24) return null;
  const startHour = 8;
  const times: string[] = [];
  for (let h = startHour; h < startHour + 24; h += interval) {
    times.push(String(h % 24).padStart(2, "0") + ":00");
  }
  return times;
}

function normalizeVia(v: string): string {
  const s = v.toLowerCase().replace(/\./g, "");
  if (s === "oral" || s === "vo") return "VO";
  if (s === "iv") return "IV";
  if (s === "im") return "IM";
  if (s === "sc") return "SC";
  if (s === "sl") return "SL";
  if (s.startsWith("inhal")) return "Inhalatoria";
  if (s.startsWith("top") || s.startsWith("tóp")) return "Tópica";
  return v.toUpperCase();
}

function parseMed(raw: string): Omit<MedItem, "id" | "grupo"> {
  const text = raw.trim();
  let work = text;

  const viaMatch = work.match(/\b(VO|v\.?o\.?|oral|IV|i\.v\.?|IM|i\.m\.?|SC|SL|inhalador|inhalatoria|t[oó]pic[oa])\b/i);
  let via = "";
  if (viaMatch) { via = normalizeVia(viaMatch[0]); work = work.replace(viaMatch[0], " "); }

  const dosisMatch = work.match(/(\d+\s?\/\s?\d+\s?(mg|g|ml|mcg|ui|%)|\d+\.?\d*\s?%|\d+\.?\d*\s?(mg|g|ml|mcg|ui|puff|amp))/i);
  let dosis = "";
  if (dosisMatch) { dosis = dosisMatch[0].replace(/\s+/g, ""); work = work.replace(dosisMatch[0], " "); }

  let frecuencia = "";
  const fm = work.match(/c\s?\/\s?(\d+)\s?h/i) || work.match(/cada\s+(\d+)\s+horas?/i);
  if (fm) { frecuencia = `cada ${fm[1]} horas`; work = work.replace(fm[0], " "); }
  else if (/\bsos\b/i.test(work)) { frecuencia = "SOS (según necesidad)"; work = work.replace(/\bsos\b/i, " "); }
  else if (/\bcontinuo\b/i.test(work)) { frecuencia = "continuo"; work = work.replace(/\bcontinuo\b/i, " "); }

  let duracion = "";
  const dm = work.match(/x\s?(\d+)\s?d(?:[ií]as)?/i) || work.match(/por\s?(\d+)\s?d[ií]as/i);
  if (dm) { duracion = `${dm[1]} días`; work = work.replace(dm[0], " "); }
  else if (/dosis\s?[úu]nica/i.test(work)) { duracion = "Dosis única"; work = work.replace(/dosis\s?[úu]nica/i, " "); }

  let nombre = work.replace(/[+|,\/-]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!nombre) nombre = text;

  const horario = scheduleFromFrequency(frecuencia);
  return { nombre, dosis, via, frecuencia, duracion, horario, raw: text };
}

function parseExam(raw: string): Omit<ExamItem, "id" | "grupo"> {
  const text = raw.trim();
  const urgente = /\burgente\b|\bstat\b/i.test(text);
  const nombre = text.replace(/,?\s*\burgente\b/i, "").replace(/,?\s*\bstat\b/i, "").trim() || text;
  return { nombre, urgencia: urgente ? "urgente" : "normal", raw: text };
}

function parseFormula(raw: string): Omit<FormItem, "id" | "grupo"> {
  const text = raw.trim();
  const parts = text.split("|").map((p) => p.trim());
  const nombreIng = parts[0] || text;
  const via = parts[1] || (text.match(/\b(t[oó]pic[oa]|VO|inhalatoria|IM|IV)\b/i) || [])[0] || "";
  const freqDur = parts[2] || "";
  const [first, ...ingRest] = nombreIng.split("—").map((s) => s.trim());
  let nombre = first;
  const ingredientes = ingRest.join(" — ") || nombreIng;
  if (!nombre) nombre = nombreIng;
  return { nombre, ingredientes, via, freqDur, raw: text };
}

/* ============================================================
   Componente
   ============================================================ */

interface RecetaProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteNombre?: string;
  pacienteEdad?: string;
  pacienteCi?: string;
  alergias?: string;
  medicoNombre?: string;
  diagnostico?: string;
  /**
   * Se dispara cada vez que cambia la lista de medicamentos recetados
   * (agregar, eliminar, deshacer, reset). El padre (RegistroClinico.tsx)
   * usa esto para llenar automáticamente el campo "Tratamiento", que en
   * ese formulario es de solo lectura.
   */
  onTratamientoChange?: (texto: string) => void;
}

const Receta = forwardRef<RecetaHandle, RecetaProps>(function Receta(
  {
    isOpen,
    onClose,
    pacienteNombre = "—",
    pacienteEdad = "—",
    pacienteCi = "—",
    alergias = "",
    medicoNombre = "Dr. Miguel",
    diagnostico = "",
    onTratamientoChange,
  }: RecetaProps,
  ref
): React.ReactElement {
  const [tab, setTab] = useState<Tab>("medicamentos");
  const [seq, setSeq] = useState(1);

  const [medicamentos, setMedicamentos] = useState<MedItem[]>([]);
  const [examenes, setExamenes] = useState<ExamItem[]>([]);
  const [formulas, setFormulas] = useState<FormItem[]>([]);

  // Grupo activo por tab: cada tab arranca en la receta 1. Al tocar
  // "+ Nueva receta" se incrementa el grupo del tab actual, y los
  // próximos ítems que se agreguen quedan en esa receta nueva.
  const [grupoActivo, setGrupoActivo] = useState<Record<Tab, number>>({
    medicamentos: 1,
    examenes: 1,
    formulas: 1,
  });

  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtered, setFiltered] = useState<DBItem[]>([]);
  const [highlighted, setHighlighted] = useState(-1);

  const [indicaciones, setIndicaciones] = useState("Tomar agua y descansar");

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- impresión con membrete CMO (solo categoría medicamentos) ----
  const [imprimirCMO, setImprimirCMO] = useState(false);
  // ---- vista previa del membrete CMO antes de imprimir ----
  const [showPreviewCMO, setShowPreviewCMO] = useState(false);
  // ---- qué receta (grupo) del tab activo se va a imprimir/previsualizar ----
  // Por defecto apunta siempre a la última receta agregada del tab.
  const [grupoImprimir, setGrupoImprimir] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);

  const fecha = useMemo(
    () => new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" }),
    []
  );

  const fechaPartes = useMemo(() => {
    const d = new Date();
    return {
      dia: String(d.getDate()).padStart(2, "0"),
      mes: String(d.getMonth() + 1).padStart(2, "0"),
      anio: String(d.getFullYear()),
    };
  }, []);

  const itemsOfTab = useCallback(
    (t: Tab): AnyItem[] => (t === "medicamentos" ? medicamentos : t === "examenes" ? examenes : formulas),
    [medicamentos, examenes, formulas]
  );

  // Grupos (recetas) que existen en el tab activo, en el orden en que
  // se fueron creando — para el selector de "cuál receta imprimir".
  const gruposDelTab = useMemo(() => {
    const vistos = new Set<number>();
    const orden: number[] = [];
    for (const it of itemsOfTab(tab)) {
      if (!vistos.has(it.grupo)) {
        vistos.add(it.grupo);
        orden.push(it.grupo);
      }
    }
    return orden;
  }, [itemsOfTab, tab]);

  /* ---------- texto de tratamiento derivado de medicamentos ----------
     Se usa para alimentar a RegistroClinico.tsx (campo "Tratamiento",
     de solo lectura ahí). Formato: "1. Nombre dosis — vía · frecuencia · duración" */
  const buildTratamientoTexto = useCallback((meds: MedItem[]): string => {
    if (!meds.length) return "";
    return meds
      .map((m, i) => {
        const dosis = m.dosis ? ` ${m.dosis}` : "";
        const partes = [m.via, m.frecuencia, m.duracion].filter(Boolean).join(" · ");
        return `${i + 1}. ${m.nombre}${dosis}${partes ? " — " + partes : ""}`;
      })
      .join("\n");
  }, []);

  useEffect(() => {
    onTratamientoChange?.(buildTratamientoTexto(medicamentos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicamentos]);

  /* ---------- handle expuesto al padre (getPayload / reset) ---------- */

  // Separa una lista de ítems en varios bloques según su `grupo`
  // (respetando el orden en que se crearon los grupos), y arma cada
  // bloque con el mapeo al shape que espera el backend.
  function agruparPorGrupo<I extends { grupo: number }, O>(
    items: I[],
    mapItem: (it: I) => O
  ): RecetaBloque<O>[] {
    const gruposOrden: number[] = [];
    const porGrupo = new Map<number, I[]>();
    for (const it of items) {
      if (!porGrupo.has(it.grupo)) {
        porGrupo.set(it.grupo, []);
        gruposOrden.push(it.grupo);
      }
      porGrupo.get(it.grupo)!.push(it);
    }
    return gruposOrden.map((g) => ({
      indicaciones_generales: indicaciones.trim() || null,
      items: porGrupo.get(g)!.map(mapItem),
    }));
  }

  useImperativeHandle(ref, () => ({
    getPayload: () => {
      const payload: RecetaPayloadSalida = {};

      if (medicamentos.length) {
        payload.medicamentos = agruparPorGrupo(medicamentos, (m) => ({
          medicamento: m.nombre,
          dosis: m.dosis || "—",
          via_administracion: m.via || null,
          frecuencia: m.frecuencia || "—",
          duracion: m.duracion || null,
          cantidad: null,
          indicaciones: null,
        }));
      }

      if (examenes.length) {
        payload.examenes = agruparPorGrupo(examenes, (e) => ({
          nombre_examen: e.nombre,
          tipo_examen: "General",
          urgencia: e.urgencia === "urgente" ? "Urgente" : "Rutina",
          indicaciones_previas: null,
        }));
      }

      if (formulas.length) {
        payload.formulas = agruparPorGrupo(formulas, (f) => ({
          nombre_formula: f.nombre,
          ingredientes: f.ingredientes || f.raw,
          forma_farmaceutica: null,
          cantidad_preparar: null,
          via_administracion: f.via || null,
          indicaciones: null,
        }));
      }

      return Object.keys(payload).length ? payload : null;
    },
    reset: () => {
      setMedicamentos([]);
      setExamenes([]);
      setFormulas([]);
      setIndicaciones("Tomar agua y descansar");
      setGrupoActivo({ medicamentos: 1, examenes: 1, formulas: 1 });
    },
  }));

  /* ---------- toast ---------- */
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

  /* ---------- comandos de items ---------- */
  const commitItem = (rawText?: string) => {
    const raw = (rawText !== undefined ? rawText : inputValue).trim();
    if (!raw) return;
    const id = seq;
    setSeq((s) => s + 1);
    const grupo = grupoActivo[tab];

    if (tab === "medicamentos") {
      const obj: MedItem = { id, grupo, ...parseMed(raw) };
      setMedicamentos((list) => [...list, obj]);
    } else if (tab === "examenes") {
      const obj: ExamItem = { id, grupo, ...parseExam(raw) };
      setExamenes((list) => [...list, obj]);
    } else {
      const obj: FormItem = { id, grupo, ...parseFormula(raw) };
      setFormulas((list) => [...list, obj]);
    }

    setInputValue("");
    setShowSuggestions(false);
    showToast("Agregado a " + TITLES[tab].toLowerCase(), () => {
      if (tab === "medicamentos") setMedicamentos((list) => list.filter((x) => x.id !== id));
      else if (tab === "examenes") setExamenes((list) => list.filter((x) => x.id !== id));
      else setFormulas((list) => list.filter((x) => x.id !== id));
    });
  };

  // Inicia una receta nueva y separada dentro del tab activo. No hace
  // nada si el tab todavía no tiene ítems (no tiene sentido abrir una
  // receta 2 vacía antes de haber llenado la 1).
  const nuevaReceta = () => {
    if (!itemsOfTab(tab).length) return;
    setGrupoActivo((g) => ({ ...g, [tab]: g[tab] + 1 }));
  };

  const removeItem = (t: Tab, id: number) => {
    const list = itemsOfTab(t);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const removed = list[idx];

    const apply = (updater: (l: any[]) => any[]) => {
      if (t === "medicamentos") setMedicamentos((l) => updater(l) as MedItem[]);
      else if (t === "examenes") setExamenes((l) => updater(l) as ExamItem[]);
      else setFormulas((l) => updater(l) as FormItem[]);
    };

    apply((l) => l.filter((x) => x.id !== id));
    showToast("Línea eliminada", () => {
      apply((l) => {
        const copy = [...l];
        copy.splice(idx, 0, removed);
        return copy;
      });
    });
  };

  const toggleUrgency = (id: number) => {
    setExamenes((list) => list.map((it) => (it.id === id ? { ...it, urgencia: it.urgencia === "urgente" ? "normal" : "urgente" } : it)));
  };

  const undoLast = () => {
    const list = itemsOfTab(tab);
    if (list.length) removeItem(tab, list[list.length - 1].id);
  };

  /* ---------- sugerencias ---------- */
  const renderSuggestions = (value: string) => {
    const q = value.trim().toLowerCase();
    if (!q) {
      setShowSuggestions(false);
      setFiltered([]);
      return;
    }
    const list = DB[tab].filter((d) => d.n.toLowerCase().includes(q)).slice(0, 6);
    setFiltered(list);
    if (!list.length) {
      setShowSuggestions(false);
      return;
    }
    setHighlighted(0);
    setShowSuggestions(true);
  };

  const acceptSuggestion = (i: number) => {
    const item = filtered[i];
    if (!item) return;
    setInputValue(item.s);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const moveHighlight = (delta: number) => {
    if (!filtered.length) return;
    setHighlighted((h) => (h + delta + filtered.length) % filtered.length);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    renderSuggestions(e.target.value);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveHighlight(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveHighlight(-1); }
    else if (e.key === "Tab" && showSuggestions) { e.preventDefault(); acceptSuggestion(highlighted < 0 ? 0 : highlighted); }
    else if (e.key === "Enter") { e.preventDefault(); commitItem(); }
    else if (e.key === "Escape") { setInputValue(""); setShowSuggestions(false); }
    else if (e.key === "Backspace" && !inputValue) {
      const list = itemsOfTab(tab);
      if (list.length) removeItem(tab, list[list.length - 1].id);
    }
  };

  /* ---------- cambio de pestaña ---------- */
  const switchTab = (t: Tab) => {
    setTab(t);
    setInputValue("");
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // La receta a imprimir/previsualizar sigue por defecto a la más
  // reciente del tab activo (así el doctor no tiene que reseleccionar
  // cada vez que agrega una receta nueva); igual puede cambiarla a mano.
  useEffect(() => {
    setGrupoImprimir(grupoActivo[tab]);
  }, [tab, grupoActivo]);

  /* ---------- cerrar drawer (abrirlo ahora lo controla el padre) ---------- */
  const closeDrawer = () => {
    onClose();
  };

  // cuando isOpen pasa a true, enfoca el input (como antes hacía openDrawer)
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 260);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /* ---------- atajos de teclado (solo funcionan si el drawer ya está abierto) ---------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") { closeDrawer(); }
      if (e.altKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        const t = (["medicamentos", "examenes", "formulas"] as Tab[])[Number(e.key) - 1];
        switchTab(t);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undoLast(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab, medicamentos, examenes, formulas, inputValue]);

  /* ---------- impresión con membrete CMO ----------
     Inyectamos un <style> con @page en orientación horizontal
     porque la plantilla (1435x1096) es apaisada, y lo quitamos
     apenas termina la impresión para no afectar otras impresiones
     de la app. */
    const handleImprimirCMO = () => {
    const pageStyle = document.createElement("style");
    pageStyle.id = "cmo-print-page-style";
    pageStyle.innerHTML = "@page { size: 14.94in 11.41in; margin: 0; }";
    document.head.appendChild(pageStyle);

    setImprimirCMO(true);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  useEffect(() => {
    const onAfterPrint = () => {
      setImprimirCMO(false);
      const pageStyle = document.getElementById("cmo-print-page-style");
      if (pageStyle) pageStyle.remove();
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const handleChipClick = (label: string) => {
    const dbItem = DB[tab].find((d) => d.n === label);
    if (dbItem) commitItem(dbItem.s);
  };

  /* ---------- render de línea del ticket ---------- */
  const renderTicketLine = (it: AnyItem, i: number) => {
    let t1 = "";
    let t2 = "";
    if (tab === "medicamentos") {
      const med = it as MedItem;
      t1 = med.nombre + (med.dosis ? " · " + med.dosis : "");
      const partes = [med.via, med.frecuencia, med.duracion].filter(Boolean);
      t2 = partes.join(" · ") || med.raw;
      if (med.horario) t2 += (t2 ? "  ·  " : "") + "🕐 " + med.horario.join(" - ");
    } else if (tab === "examenes") {
      t1 = (it as ExamItem).nombre;
    } else {
      const f = it as FormItem;
      t1 = f.nombre;
      t2 = [f.ingredientes, f.via, f.freqDur].filter(Boolean).join(" · ");
    }
    return (
      <div className={styles["ticket-line"]} key={it.id}>
        <div className={styles.num}>{i + 1}</div>
        <div className={styles.body}>
          <div className={styles.t1}>{t1}</div>
          {t2 && <div className={styles.t2}>{t2}</div>}
        </div>
        {tab === "examenes" && (
          <div
            className={cx(styles["urgency-badge"], styles[(it as ExamItem).urgencia])}
            onClick={() => toggleUrgency(it.id)}
          >
            {(it as ExamItem).urgencia}
          </div>
        )}
        <button type="button" className={styles.rm} title="Eliminar" onClick={() => removeItem(tab, it.id)}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    );
  };

  /* ---------- render de sección del papel ---------- */
  const renderPaperMed = () =>
    medicamentos.length ? (
      medicamentos.map((it, i) => {
        const t1 = it.nombre + (it.dosis ? " " + it.dosis : "");
        const meta = [it.via, it.frecuencia, it.duracion].filter(Boolean).join(" · ");
        return (
          <div className={styles["rx-item"]} key={it.id}>
            <span className={styles.idx}>{i + 1}.</span>
            {t1}
            {meta && <div className={styles.meta}>{meta}</div>}
            {it.horario && <div className={styles.meta}>Horario sugerido: {it.horario.join(" · ")}</div>}
          </div>
        );
      })
    ) : (
      <div className={styles["paper-empty"]}>Sin ítems aún</div>
    );

  const renderPaperExam = () =>
    examenes.length ? (
      examenes.map((it, i) => (
        <div className={styles["rx-item"]} key={it.id}>
          <span className={styles.idx}>{i + 1}.</span>
          {it.nombre}
          {it.urgencia === "urgente" && (
            <span style={{ color: "var(--status-inactive)", fontWeight: 700 }}> (URGENTE)</span>
          )}
        </div>
      ))
    ) : (
      <div className={styles["paper-empty"]}>Sin ítems aún</div>
    );

  const renderPaperForm = () =>
    formulas.length ? (
      formulas.map((it, i) => {
        const meta = [it.ingredientes, it.via, it.freqDur].filter(Boolean).join(" · ");
        return (
          <div className={styles["rx-item"]} key={it.id}>
            <span className={styles.idx}>{i + 1}.</span>
            {it.nombre}
            {meta && <div className={styles.meta}>{meta}</div>}
          </div>
        );
      })
    ) : (
      <div className={styles["paper-empty"]}>Sin ítems aún</div>
    );

  /* ---------- contenido superpuesto al membrete CMO ----------
     Compartido entre la vista previa en pantalla (modal) y la
     impresión final, para que ambos se vean idénticos. Usa la
     categoría (pestaña) activa — así cada categoría se imprime
     por separado: el doctor llena medicamentos, imprime con
     membrete, cambia a exámenes, imprime de nuevo, etc.

     En la pestaña de EXÁMENES, además de la lista de ítems, se
     agrega al final (parte de abajo, después de todos los
     exámenes) el diagnóstico del paciente, tomado de
     RegistroClinico.tsx a través del prop `diagnostico`.

     Cuando el tab tiene varias recetas (grupos), solo se pinta la
     receta elegida en `grupoImprimir` — cada receta se imprime aparte,
     con el mismo membrete, en vez de mezclarlas todas en una hoja. */
  const renderCmoItems = () => {
  const list = itemsOfTab(tab).filter((it) => it.grupo === grupoImprimir);

  const header = (
    <div className={styles["cmo-rp-header"]}>
      <div className={styles["cmo-rp-header-name"]}>
        <strong>Paciente:</strong> {pacienteNombre}
      </div>
      <div className={styles["cmo-rp-header-age"]}>
        <strong>Edad:</strong> {pacienteEdad}
      </div>
    </div>
  );

  if (tab === "examenes") {
    const items = list as ExamItem[];
    return (
      <>
        {header}
        {items.length ? (
          items.map((it, i) => (
            <div key={it.id} className={styles["cmo-rp-line"]}>
              {i + 1}. {it.nombre}
              {it.urgencia === "urgente" && <span className={styles["cmo-rp-meta"]}> — URGENTE</span>}
            </div>
          ))
        ) : (
          <div className={styles["cmo-rp-line"]}>Sin exámenes</div>
        )}
      </>
    );
  }

  if (!list.length) {
    return (
      <>
        {header}
        <div className={styles["cmo-rp-line"]}>Sin {TITLES[tab].toLowerCase()}</div>
      </>
    );
  }

  if (tab === "medicamentos") {
    return (
      <>
        {header}
        {(list as MedItem[]).map((m, i) => {
          const instrucciones = [m.via, m.frecuencia, m.duracion].filter(Boolean).join(" · ");
          return (
            <div key={m.id} className={styles["cmo-rp-med-row"]}>
              <div className={styles["cmo-rp-med-col-left"]}>
                <span className={styles["cmo-rp-num"]}>{i + 1}.</span>
                <span className={styles["cmo-rp-med-name"]}>
                  {m.nombre}
                  {m.dosis ? ` ${m.dosis}` : ""}
                </span>
              </div>
              <div className={styles["cmo-rp-med-col-right"]}>
                {instrucciones && <div className={styles["cmo-rp-instrucciones"]}>{instrucciones}</div>}
                {m.horario && m.horario.length > 0 && (
                  <div className={styles["cmo-rp-horario"]}>🕐 {m.horario.join(" · ")}</div>
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      {header}
      {(list as FormItem[]).map((it, i) => {
        const meta = [it.ingredientes, it.via, it.freqDur].filter(Boolean).join(" · ");
        return (
          <div key={it.id} className={styles["cmo-rp-line"]}>
            {i + 1}. {it.nombre}
            {meta && <span className={styles["cmo-rp-meta"]}> — {meta}</span>}
          </div>
        );
      })}
    </>
  );
};

  const renderCmoRp = () => (
  <>
    <div className={styles["cmo-rp"]}>{renderCmoItems()}</div>
    {tab === "examenes" && (
      <div className={styles["cmo-rp-diagnostico"]}>
        <strong>Diagnóstico:</strong> {diagnostico?.trim() ? diagnostico : "No especificado"}
      </div>
    )}
    <div className={styles["cmo-fecha"]}>
      <span>{fechaPartes.dia}</span>
      <span>{fechaPartes.mes}</span>
      <span>{fechaPartes.anio}</span>
    </div>
  </>
);

  const tieneAlergias = Boolean(alergias && alergias.trim());

  return (
    <div className={cx(styles["receta-widget"], imprimirCMO && styles["printing-cmo"])}>
      <div className={cx(styles.overlay, isOpen && styles.show)} onClick={closeDrawer} />

      {/* ================= DRAWER: RECETA ================= */}
      <div className={cx(styles.drawer, isOpen && styles.show)}>
        <div className={styles["drawer-head"]}>
          <div className={styles.ico}><FontAwesomeIcon icon={faPrescriptionBottle} /></div>
          <div className={styles.titles}>
            <h3>Receta médica</h3>
            <p className={cx(styles["drawer-alergias"], tieneAlergias && styles.tiene)}>
              <FontAwesomeIcon icon={faTriangleExclamation} /> Alergias: {tieneAlergias ? alergias : "No"}
            </p>
          </div>
          <div className={styles.badge}>tipo_receta_id: {TIPO_ID[tab]}</div>
          <div className={styles["drawer-close"]} onClick={closeDrawer}>
            <FontAwesomeIcon icon={faXmark} />
          </div>
        </div>

        <div className={styles["drawer-body"]}>
          <div className={styles["rx-grid"]}>
            {/* ================= EDITOR ================= */}
            <div>
              <div className={styles.field}>
                <div className={styles.flabel}><FontAwesomeIcon icon={faFileMedical} className={styles.ficon} />Tipo de receta</div>

                <div className={styles["type-chips"]}>
                  <button
                    type="button"
                    className={cx(styles["type-chip"], styles["tab-med"], tab === "medicamentos" && styles.active)}
                    onClick={() => switchTab("medicamentos")}
                  >
                    <FontAwesomeIcon icon={faPills} /> Medicamentos <span className={styles.k}>Alt+1</span>
                  </button>
                  <button
                    type="button"
                    className={cx(styles["type-chip"], styles["tab-exam"], tab === "examenes" && styles.active)}
                    onClick={() => switchTab("examenes")}
                  >
                    <FontAwesomeIcon icon={faFlaskVial} /> Exámenes <span className={styles.k}>Alt+2</span>
                  </button>
                  <button
                    type="button"
                    className={cx(styles["type-chip"], styles["tab-form"], tab === "formulas" && styles.active)}
                    onClick={() => switchTab("formulas")}
                  >
                    <FontAwesomeIcon icon={faMortarPestle} /> Fórmulas <span className={styles.k}>Alt+3</span>
                  </button>
                </div>

                <div className={styles.chips}>
                  {CHIPS[tab].map((label) => (
                    <button type="button" className={styles["chip-quick"]} key={label} onClick={() => handleChipClick(label)}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className={styles["row-entry"]}>
                  <div className={styles["smart-row"]}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={PLACEHOLDER[tab]}
                      autoComplete="off"
                      value={inputValue}
                      onChange={onInputChange}
                      onKeyDown={onInputKeyDown}
                    />
                    <button type="button" className={cx(styles["icon-btn"], styles.primary)} title="Agregar (Enter)" onClick={() => commitItem()}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>

                  {showSuggestions && (
                    <div className={styles.suggestions}>
                      {filtered.map((item, i) => (
                        <div
                          key={item.n}
                          className={cx(styles["sugg-item"], i === highlighted && styles.hi)}
                          onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(i); }}
                        >
                          <span className={styles.name}>{item.n}</span>
                          <span className={styles.preview}>{item.s}<span className={styles["sugg-tabhint"]}>Tab</span></span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles["kbd-hints"]}>
                    <span><kbd>Enter</kbd> agregar</span>
                    <span><kbd>Tab</kbd> autocompletar</span>
                    <span><kbd>↑↓</kbd> navegar</span>
                    <span><kbd>Backspace</kbd> vacío borra la última</span>
                    <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer</span>
                  </div>
                </div>

                {itemsOfTab(tab).length > 0 && (
                  <div className={styles["ticket-toolbar"]}>
                    <button type="button" className={styles["new-receta-btn"]} onClick={nuevaReceta}>
                      <FontAwesomeIcon icon={faPlus} /> Nueva receta
                    </button>
                  </div>
                )}

                <div className={styles.ticket}>
                  {itemsOfTab(tab).length === 0 ? (
                    <div className={styles["ticket-empty"]}>Aún no agregaste ninguna línea. Escribe arriba o toca un frecuente.</div>
                  ) : (
                    (() => {
                      const items = itemsOfTab(tab);
                      const nodes: React.ReactNode[] = [];
                      let prevGrupo: number | null = null;
                      items.forEach((it, i) => {
                        if (it.grupo !== prevGrupo) {
                          if (prevGrupo !== null) {
                            nodes.push(
                              <div key={`sep-${it.grupo}`} className={styles["ticket-sep"]}>
                                <span>Receta {it.grupo}</span>
                              </div>
                            );
                          }
                          prevGrupo = it.grupo;
                        }
                        nodes.push(renderTicketLine(it, i));
                      });
                      return nodes;
                    })()
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.flabel}>
                  <FontAwesomeIcon icon={faNotesMedical} className={styles.ficon} />Indicaciones generales
                  <small>Enter la refleja en la hojita</small>
                </div>
                <textarea
                  rows={3}
                  placeholder="Ej. Tomar abundante agua y reposo relativo por 48h..."
                  value={indicaciones}
                  onChange={(e) => setIndicaciones(e.target.value)}
                />
              </div>
            </div>

            {/* ================= PAPEL ================= */}
            <div className={styles["paper-wrap"]}>
              {gruposDelTab.length > 1 && (
                <div className={styles["receta-picker"]}>
                  <span className={styles["receta-picker-label"]}>Receta a imprimir:</span>
                  {gruposDelTab.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={cx(styles["receta-picker-btn"], g === grupoImprimir && styles.active)}
                      onClick={() => setGrupoImprimir(g)}
                    >
                      Receta {g}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles["paper-toolbar"]}>
                <button type="button" className={styles["icon-btn"]} onClick={() => setShowPreviewCMO(true)}>
                  Vista previa CMO · {TITLES[tab]}{gruposDelTab.length > 1 ? ` · Receta ${grupoImprimir}` : ""}
                </button>
                <button type="button" className={cx(styles["icon-btn"], styles.primary)} onClick={handleImprimirCMO}>
                  Imprimir {TITLES[tab]} (CMO){gruposDelTab.length > 1 ? ` · Receta ${grupoImprimir}` : ""}
                </button>
              </div>

              <div className={styles.paper}>
                <div className={styles["paper-margin"]} />
                <div className={styles["paper-inner"]}>
                  <div className={styles["paper-head"]}>
                    <div>
                      <div className={styles.clinic}>{CLINICA.nombre}</div>
                      <div className={styles["clinic-sub"]}>{CLINICA.direccion}</div>
                    </div>
                    <div className={styles["rx-mark"]}>℞</div>
                  </div>
                  <div className={styles["paper-meta"]}>
                    <div><span>Paciente: </span><b>{pacienteNombre}</b></div>
                    <div><span>Fecha: </span><b>{fecha}</b></div>
                    <div><span>Edad: </span><b>{pacienteEdad}</b></div>
                    <div><span>Doc: </span><b>{pacienteCi}</b></div>
                  </div>

                  <div className={styles["paper-section-title"]}>Medicamentos</div>
                  <div>{renderPaperMed()}</div>

                  <div className={styles["paper-section-title"]}>Exámenes complementarios</div>
                  <div>{renderPaperExam()}</div>

                  <div className={styles["paper-section-title"]}>Fórmulas magistrales</div>
                  <div>{renderPaperForm()}</div>

                  <div className={styles["paper-section-title"]}>Indicaciones generales</div>
                  <div>
                    {indicaciones.trim() ? (
                      <div className={styles["paper-indicaciones-text"]}>{indicaciones.trim()}</div>
                    ) : (
                      <div className={styles["paper-empty"]}>Sin indicaciones</div>
                    )}
                  </div>

                  <div className={styles["paper-sign"]}>
                    <div className={styles.line}>{medicoNombre}</div>
                    <div className={styles.date}>{fecha}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= IMPRESIÓN CON MEMBRETE CMO ================= */}
      {imprimirCMO && (
        <div className={styles["cmo-print"]}>
          <div className={styles["cmo-canvas"]}>
            <img src={RecetaImprimir} alt="Receta CMO" />
            {renderCmoRp()}
          </div>
        </div>
      )}

      {/* ================= VISTA PREVIA DEL MEMBRETE CMO ================= */}
      {showPreviewCMO && (
        <div className={styles["cmo-preview-overlay"]} onClick={() => setShowPreviewCMO(false)}>
          <div className={styles["cmo-preview-box"]} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles["cmo-preview-close"]}
              onClick={() => setShowPreviewCMO(false)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <div className={styles["cmo-preview-title"]}>{TITLES[tab]}{gruposDelTab.length > 1 ? ` · Receta ${grupoImprimir}` : ""}</div>
            <div className={styles["cmo-canvas"]}>
              <img src={RecetaImprimir} alt="Vista previa receta CMO" />
              {renderCmoRp()}
            </div>
            <div className={styles["cmo-preview-actions"]}>
              <button
                type="button"
                className={cx(styles["icon-btn"], styles.primary)}
                onClick={() => { setShowPreviewCMO(false); handleImprimirCMO(); }}
              >
                Imprimir {TITLES[tab]}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={cx(styles.toast, toast && styles.show)}>
        <span>{toast?.msg}</span>
        {toast?.undo && (
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
    </div>
  );
});

export default Receta;
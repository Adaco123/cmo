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
   Tipos — alineados 1:1 con receta.ts. Cada campo del payload es
   su propio input; se manda tal cual, sin capa de parseo intermedia.
   ============================================================ */

type Tab = "medicamentos" | "examenes" | "formulas";

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
  /** Devuelve solo los bloques (recetas) que tienen al menos un ítem. `null` si no hay nada. */
  getPayload: () => RecetaPayloadSalida | null;
  /** Limpia todo — llamar después de un guardado exitoso. */
  reset: () => void;
}

interface MedItem {
  id: number;
  medicamento: string;
  dosis: string;
  via_administracion: string;
  frecuencia: string;
  duracion: string;
  cantidad: string;
  indicaciones: string;
  horario: string[] | null;
}

interface ExamItem {
  id: number;
  nombre_examen: string;
  tipo_examen: string;
  urgencia: "Rutina" | "Urgente";
  indicaciones_previas: string;
}

interface FormItem {
  id: number;
  nombre_formula: string;
  ingredientes: string;
  forma_farmaceutica: string;
  cantidad_preparar: string;
  via_administracion: string;
  indicaciones: string;
}

type AnyItem = MedItem | ExamItem | FormItem;

/* ============================================================
   Una "receta" es un grupo de ítems con su propio id. El doctor
   llena varias recetas dentro de la misma categoría (ej. 2 recetas
   de medicamentos separadas) tocando "+ Nueva receta"; los ítems
   que agrega después van siempre a la receta activa de esa
   categoría (`grupoActivoId[tab]`), no necesariamente la última en
   el array (por si en el futuro se permite reordenar o insertar).
   ============================================================ */
interface Grupo<T> {
  id: number;
  items: T[];
}

interface ToastState {
  msg: string;
  undo?: () => void;
}

/* ============================================================
   Definición de campos por pestaña
   ============================================================ */

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  width: "sm" | "md" | "lg";
  required?: boolean;
  autocomplete?: boolean;
  datalist?: string[];
  select?: string[];
}

const MED_FIELDS: FieldDef[] = [
  { key: "medicamento", label: "Medicamento", placeholder: "Paracetamol", width: "lg", required: true, autocomplete: true },
  { key: "dosis", label: "Dosis", placeholder: "500mg", width: "sm", required: true },
  { key: "via_administracion", label: "Vía", placeholder: "VO", width: "sm", datalist: ["VO", "IV", "IM", "SC", "SL", "Inhalatoria", "Tópica"] },
  { key: "frecuencia", label: "Frecuencia", placeholder: "c/8h", width: "sm", required: true },
  { key: "duracion", label: "Duración", placeholder: "5 días", width: "sm" },
  { key: "cantidad", label: "Cantidad", placeholder: "20 tabletas", width: "sm" },
  { key: "indicaciones", label: "Indicaciones", placeholder: "Con alimentos", width: "md" },
];

const EXAM_FIELDS: FieldDef[] = [
  { key: "nombre_examen", label: "Examen", placeholder: "Hemograma completo", width: "lg", required: true, autocomplete: true },
  { key: "tipo_examen", label: "Tipo", placeholder: "Laboratorio", width: "sm", datalist: ["Laboratorio", "Imagenología", "Gabinete", "General"] },
  { key: "urgencia", label: "Urgencia", width: "sm", select: ["Rutina", "Urgente"] },
  { key: "indicaciones_previas", label: "Indicaciones previas", placeholder: "En ayunas 8h", width: "md" },
];

const FORM_FIELDS: FieldDef[] = [
  { key: "nombre_formula", label: "Fórmula", placeholder: "Crema compuesta", width: "lg", required: true, autocomplete: true },
  { key: "ingredientes", label: "Ingredientes", placeholder: "Betametasona 0.1% + Ác. salicílico 3%", width: "lg", required: true },
  { key: "forma_farmaceutica", label: "Forma farmacéutica", placeholder: "Crema", width: "sm" },
  { key: "cantidad_preparar", label: "Cantidad a preparar", placeholder: "30g", width: "sm" },
  { key: "via_administracion", label: "Vía", placeholder: "Tópica", width: "sm", datalist: ["VO", "IV", "IM", "SC", "SL", "Inhalatoria", "Tópica"] },
  { key: "indicaciones", label: "Indicaciones", placeholder: "Aplicar en la noche", width: "md" },
];

const FIELDS_BY_TAB: Record<Tab, FieldDef[]> = {
  medicamentos: MED_FIELDS,
  examenes: EXAM_FIELDS,
  formulas: FORM_FIELDS,
};

const NAME_KEY_BY_TAB: Record<Tab, string> = {
  medicamentos: "medicamento",
  examenes: "nombre_examen",
  formulas: "nombre_formula",
};

function emptyDraftFor(t: Tab): Record<string, string> {
  const base: Record<string, string> = {};
  FIELDS_BY_TAB[t].forEach((f) => { base[f.key] = ""; });
  if (t === "examenes") { base.tipo_examen = "General"; base.urgencia = "Rutina"; }
  return base;
}

/* ============================================================
   Bases de datos de sugerencias / chips rápidos
   ============================================================ */

const MED_DB: Record<string, string>[] = [
  { medicamento: "Paracetamol", dosis: "500mg", via_administracion: "VO", frecuencia: "c/8h", duracion: "5 días" },
  { medicamento: "Ibuprofeno", dosis: "400mg", via_administracion: "VO", frecuencia: "c/8h", duracion: "5 días" },
  { medicamento: "Amoxicilina", dosis: "500mg", via_administracion: "VO", frecuencia: "c/8h", duracion: "7 días" },
  { medicamento: "Amoxicilina/Clavulánico", dosis: "875/125mg", via_administracion: "VO", frecuencia: "c/12h", duracion: "7 días" },
  { medicamento: "Omeprazol", dosis: "20mg", via_administracion: "VO", frecuencia: "c/24h", duracion: "14 días" },
  { medicamento: "Loratadina", dosis: "10mg", via_administracion: "VO", frecuencia: "c/24h", duracion: "7 días" },
  { medicamento: "Metformina", dosis: "850mg", via_administracion: "VO", frecuencia: "c/12h", duracion: "Continuo" },
  { medicamento: "Losartán", dosis: "50mg", via_administracion: "VO", frecuencia: "c/24h", duracion: "Continuo" },
  { medicamento: "Diclofenaco", dosis: "50mg", via_administracion: "VO", frecuencia: "c/8h", duracion: "3 días" },
  { medicamento: "Azitromicina", dosis: "500mg", via_administracion: "VO", frecuencia: "c/24h", duracion: "3 días" },
  { medicamento: "Ciprofloxacino", dosis: "500mg", via_administracion: "VO", frecuencia: "c/12h", duracion: "7 días" },
  { medicamento: "Salbutamol inhalador", dosis: "2 puff", via_administracion: "Inhalatoria", frecuencia: "c/6h", duracion: "SOS (según necesidad)" },
  { medicamento: "Dexametasona", dosis: "4mg", via_administracion: "IM", frecuencia: "Dosis única", duracion: "" },
  { medicamento: "Ranitidina", dosis: "150mg", via_administracion: "VO", frecuencia: "c/12h", duracion: "10 días" },
  { medicamento: "Ácido fólico", dosis: "5mg", via_administracion: "VO", frecuencia: "c/24h", duracion: "30 días" },
  { medicamento: "Complejo B", dosis: "1 amp", via_administracion: "IM", frecuencia: "c/24h", duracion: "5 días" },
  { medicamento: "Cetirizina", dosis: "10mg", via_administracion: "VO", frecuencia: "c/24h", duracion: "10 días" },
  { medicamento: "Metoclopramida", dosis: "10mg", via_administracion: "VO", frecuencia: "c/8h", duracion: "3 días" },
];
const MED_CHIPS = ["Diclofenaco", "Azitromicina", "Complejo B"];

const EXAM_DB: Record<string, string>[] = [
  { nombre_examen: "Hemograma completo", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Glicemia en ayunas", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Perfil lipídico", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Examen general de orina", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Perfil hepático", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Perfil renal", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Radiografía de tórax", tipo_examen: "Imagenología", urgencia: "Rutina" },
  { nombre_examen: "Electrocardiograma", tipo_examen: "Gabinete", urgencia: "Rutina" },
  { nombre_examen: "Ecografía abdominal", tipo_examen: "Imagenología", urgencia: "Rutina" },
  { nombre_examen: "PCR (Proteína C Reactiva)", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "VSG", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Prueba de embarazo", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Cultivo de orina", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "TSH", tipo_examen: "Laboratorio", urgencia: "Rutina" },
  { nombre_examen: "Coproparasitológico", tipo_examen: "Laboratorio", urgencia: "Rutina" },
];
const EXAM_CHIPS = ["Hemograma completo", "Glicemia en ayunas", "Examen general de orina", "Radiografía de tórax", "Perfil lipídico", "Electrocardiograma", "Ecografía abdominal", "PCR (Proteína C Reactiva)"];

const FORM_DB: Record<string, string>[] = [
  { nombre_formula: "Crema Betametasona + Ác. Salicílico", ingredientes: "Betametasona 0.1% + Ácido salicílico 3%", forma_farmaceutica: "Crema", cantidad_preparar: "30g", via_administracion: "Tópica" },
  { nombre_formula: "Solución para nebulizar", ingredientes: "Salbutamol + Bromuro de ipratropio", forma_farmaceutica: "Solución para nebulizar", cantidad_preparar: "4ml", via_administracion: "Inhalatoria" },
  { nombre_formula: "Jarabe pediátrico compuesto", ingredientes: "Paracetamol + Clorfenamina", forma_farmaceutica: "Jarabe", cantidad_preparar: "100ml", via_administracion: "VO" },
  { nombre_formula: "Loción capilar compuesta", ingredientes: "Minoxidil 5% + Finasteride 0.1%", forma_farmaceutica: "Loción capilar", cantidad_preparar: "60ml", via_administracion: "Tópica" },
];
const FORM_CHIPS = FORM_DB.map((f) => f.nombre_formula);

const DB: Record<Tab, Record<string, string>[]> = { medicamentos: MED_DB, examenes: EXAM_DB, formulas: FORM_DB };
const CHIPS: Record<Tab, string[]> = { medicamentos: MED_CHIPS, examenes: EXAM_CHIPS, formulas: FORM_CHIPS };
const TITLES: Record<Tab, string> = { medicamentos: "Medicamentos", examenes: "Exámenes", formulas: "Fórmulas magistrales" };
const TIPO_ID: Record<Tab, number> = { medicamentos: 1, examenes: 2, formulas: 3 };

/* ============================================================
   Horario sugerido a partir de la frecuencia
   ============================================================ */
function scheduleFromFrequency(frecuencia: string): string[] | null {
  if (!frecuencia) return null;
  const m = frecuencia.match(/cada\s+(\d+)\s+horas?/i) || frecuencia.match(/c\s?\/\s?(\d+)\s?h/i);
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
  onTratamientoChange?: (texto: string) => void;
}

const grupoInicial = <T,>(): Grupo<T>[] => [{ id: 1, items: [] }];

const Receta = forwardRef<RecetaHandle, RecetaProps>(function Receta(
  {
    isOpen,
    onClose,
    pacienteNombre = "—",
    pacienteEdad = "—",
    pacienteCi = "—",
    alergias = "",
    medicoNombre = "",
    diagnostico = "",
    onTratamientoChange,
  }: RecetaProps,
  ref
): React.ReactElement {
  const [tab, setTab] = useState<Tab>("medicamentos");
  const [seq, setSeq] = useState(1);

  /* ---- recetas (grupos de ítems) por categoría ----
     Cada categoría arranca con UNA receta (id 1). "+ Nueva receta"
     agrega otra al final y la vuelve la activa; los ítems que se
     agreguen después caen ahí hasta que el doctor cree otra o
     cambie de categoría. */
  const [medGrupos, setMedGrupos] = useState<Grupo<MedItem>[]>(() => grupoInicial());
  const [examGrupos, setExamGrupos] = useState<Grupo<ExamItem>[]>(() => grupoInicial());
  const [formGrupos, setFormGrupos] = useState<Grupo<FormItem>[]>(() => grupoInicial());
  const grupoSeqRef = useRef<Record<Tab, number>>({ medicamentos: 2, examenes: 2, formulas: 2 });

  const [grupoActivoId, setGrupoActivoId] = useState<Record<Tab, number>>({
    medicamentos: 1, examenes: 1, formulas: 1,
  });
  // Receta que se está previsualizando / se imprimiría individualmente.
  // Sigue por defecto a la receta activa de cada categoría.
  const [grupoPreview, setGrupoPreview] = useState(1);

  const [draft, setDraft] = useState<Record<string, string>>(() => emptyDraftFor("medicamentos"));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtered, setFiltered] = useState<Record<string, string>[]>([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [shakeField, setShakeField] = useState<string | null>(null);

  const [indicaciones, setIndicaciones] = useState("Tomar agua y descansar");

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Qué se está imprimiendo ahora mismo (null = nada). Contiene la
  // categoría y la lista de recetas (grupos) a imprimir, cada una en
  // su propia media hoja carta — dos caben por página.
  const [imprimir, setImprimir] = useState<{ tab: Tab; grupoIds: number[] } | null>(null);

  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const fechaPartes = useMemo(() => {
    const d = new Date();
    return {
      dia: String(d.getDate()).padStart(2, "0"),
      mes: String(d.getMonth() + 1).padStart(2, "0"),
      anio: String(d.getFullYear()),
    };
  }, []);

  /* ---------- acceso genérico a los grupos de la pestaña activa ---------- */
  const gruposOfTab = useCallback(
    (t: Tab): Grupo<AnyItem>[] =>
      (t === "medicamentos" ? medGrupos : t === "examenes" ? examGrupos : formGrupos) as Grupo<AnyItem>[],
    [medGrupos, examGrupos, formGrupos]
  );

  const setGruposOfTab = useCallback((t: Tab, updater: (gs: Grupo<AnyItem>[]) => Grupo<AnyItem>[]) => {
    if (t === "medicamentos") setMedGrupos((gs) => updater(gs as Grupo<AnyItem>[]) as Grupo<MedItem>[]);
    else if (t === "examenes") setExamGrupos((gs) => updater(gs as Grupo<AnyItem>[]) as Grupo<ExamItem>[]);
    else setFormGrupos((gs) => updater(gs as Grupo<AnyItem>[]) as Grupo<FormItem>[]);
  }, []);

  const flatten = <T,>(grupos: Grupo<T>[]): T[] => grupos.flatMap((g) => g.items);

  const totalItemsTab = flatten(gruposOfTab(tab)).length;
  const gruposConItemsTab = gruposOfTab(tab).filter((g) => g.items.length);

  /* ---------- texto de tratamiento derivado de medicamentos ---------- */
  const buildTratamientoTexto = useCallback((meds: MedItem[]): string => {
    if (!meds.length) return "";
    return meds
      .map((m, i) => {
        const dosis = m.dosis ? ` ${m.dosis}` : "";
        const partes = [m.via_administracion, m.frecuencia, m.duracion].filter(Boolean).join(" · ");
        return `${i + 1}. ${m.medicamento}${dosis}${partes ? " — " + partes : ""}`;
      })
      .join("\n");
  }, []);

  useEffect(() => {
    onTratamientoChange?.(buildTratamientoTexto(flatten(medGrupos)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medGrupos]);

  /* ---------- handle expuesto al padre ---------- */
  useImperativeHandle(ref, () => ({
    getPayload: () => {
      const payload: RecetaPayloadSalida = {};

      const bloques = <I, O>(grupos: Grupo<I>[], mapItem: (it: I) => O): RecetaBloque<O>[] =>
        grupos
          .filter((g) => g.items.length)
          .map((g) => ({
            indicaciones_generales: indicaciones.trim() || null,
            items: g.items.map(mapItem),
          }));

      if (flatten(medGrupos).length) {
        payload.medicamentos = bloques(medGrupos, (m) => ({
          medicamento: m.medicamento,
          dosis: m.dosis || "—",
          via_administracion: m.via_administracion || null,
          frecuencia: m.frecuencia || "—",
          duracion: m.duracion || null,
          cantidad: m.cantidad || null,
          indicaciones: m.indicaciones || null,
        }));
      }

      if (flatten(examGrupos).length) {
        payload.examenes = bloques(examGrupos, (e) => ({
          nombre_examen: e.nombre_examen,
          tipo_examen: e.tipo_examen || "General",
          urgencia: e.urgencia,
          indicaciones_previas: e.indicaciones_previas || null,
        }));
      }

      if (flatten(formGrupos).length) {
        payload.formulas = bloques(formGrupos, (f) => ({
          nombre_formula: f.nombre_formula,
          ingredientes: f.ingredientes,
          forma_farmaceutica: f.forma_farmaceutica || null,
          cantidad_preparar: f.cantidad_preparar || null,
          via_administracion: f.via_administracion || null,
          indicaciones: f.indicaciones || null,
        }));
      }

      return Object.keys(payload).length ? payload : null;
    },
    reset: () => {
      setMedGrupos(grupoInicial());
      setExamGrupos(grupoInicial());
      setFormGrupos(grupoInicial());
      setIndicaciones("Tomar agua y descansar");
      setGrupoActivoId({ medicamentos: 1, examenes: 1, formulas: 1 });
      setDraft(emptyDraftFor(tab));
      grupoSeqRef.current = { medicamentos: 2, examenes: 2, formulas: 2 };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }));

  /* ---------- toast ---------- */
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

  /* ---------- agregar un ítem a la receta activa de la pestaña ---------- */
  const commitValues = (values: Record<string, string>) => {
    const id = seq;
    setSeq((s) => s + 1);
    const grupoId = grupoActivoId[tab];

    if (tab === "medicamentos") {
      const obj: MedItem = {
        id,
        medicamento: values.medicamento.trim(),
        dosis: (values.dosis || "").trim(),
        via_administracion: (values.via_administracion || "").trim(),
        frecuencia: (values.frecuencia || "").trim(),
        duracion: (values.duracion || "").trim(),
        cantidad: (values.cantidad || "").trim(),
        indicaciones: (values.indicaciones || "").trim(),
        horario: scheduleFromFrequency(values.frecuencia || ""),
      };
      setMedGrupos((gs) => gs.map((g) => (g.id === grupoId ? { ...g, items: [...g.items, obj] } : g)));
    } else if (tab === "examenes") {
      const obj: ExamItem = {
        id,
        nombre_examen: values.nombre_examen.trim(),
        tipo_examen: (values.tipo_examen || "General").trim(),
        urgencia: values.urgencia === "Urgente" ? "Urgente" : "Rutina",
        indicaciones_previas: (values.indicaciones_previas || "").trim(),
      };
      setExamGrupos((gs) => gs.map((g) => (g.id === grupoId ? { ...g, items: [...g.items, obj] } : g)));
    } else {
      const obj: FormItem = {
        id,
        nombre_formula: values.nombre_formula.trim(),
        ingredientes: (values.ingredientes || "").trim(),
        forma_farmaceutica: (values.forma_farmaceutica || "").trim(),
        cantidad_preparar: (values.cantidad_preparar || "").trim(),
        via_administracion: (values.via_administracion || "").trim(),
        indicaciones: (values.indicaciones || "").trim(),
      };
      setFormGrupos((gs) => gs.map((g) => (g.id === grupoId ? { ...g, items: [...g.items, obj] } : g)));
    }

    showToast("Agregado a " + TITLES[tab].toLowerCase(), () => removeItem(tab, grupoId, id));
  };

  /* ---------- validación de la fila antes de agregar ---------- */
  const primerCampoInvalido = (): string | null => {
    for (const f of FIELDS_BY_TAB[tab]) {
      if (f.required && !draft[f.key]?.trim()) return f.key;
    }
    return null;
  };

  const attemptCommit = () => {
    const invalido = primerCampoInvalido();
    if (invalido) {
      setShakeField(invalido);
      setTimeout(() => setShakeField(null), 400);
      fieldRefs.current[invalido]?.focus();
      return;
    }
    commitValues(draft);
    setDraft(emptyDraftFor(tab));
    setShowSuggestions(false);
    fieldRefs.current[NAME_KEY_BY_TAB[tab]]?.focus();
  };

  /* ---------- nueva receta / eliminar receta ---------- */
  const nuevaReceta = () => {
    const activo = gruposOfTab(tab).find((g) => g.id === grupoActivoId[tab]);
    if (!activo || !activo.items.length) return; // no crear una receta vacía extra
    const nuevoId = grupoSeqRef.current[tab]++;
    setGruposOfTab(tab, (gs) => [...gs, { id: nuevoId, items: [] }]);
    setGrupoActivoId((a) => ({ ...a, [tab]: nuevoId }));
  };

  const eliminarReceta = (t: Tab, grupoId: number) => {
    const grupos = gruposOfTab(t);
    if (grupos.length <= 1) return; // siempre queda al menos una
    setGruposOfTab(t, (gs) => gs.filter((g) => g.id !== grupoId));
    if (grupoActivoId[t] === grupoId) {
      const restantes = grupos.filter((g) => g.id !== grupoId);
      const nuevoActivo = restantes[restantes.length - 1].id;
      setGrupoActivoId((a) => ({ ...a, [t]: nuevoActivo }));
    }
  };

  const removeItem = (t: Tab, grupoId: number, itemId: number) => {
    const grupo = gruposOfTab(t).find((g) => g.id === grupoId);
    if (!grupo) return;
    const idx = grupo.items.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const removed = grupo.items[idx];

    setGruposOfTab(t, (gs) =>
      gs.map((g) => (g.id === grupoId ? { ...g, items: g.items.filter((it) => it.id !== itemId) } : g))
    );

    showToast("Línea eliminada", () => {
      setGruposOfTab(t, (gs) =>
        gs.map((g) => {
          if (g.id !== grupoId) return g;
          const copy = [...g.items];
          copy.splice(idx, 0, removed);
          return { ...g, items: copy };
        })
      );
    });
  };

  const toggleUrgency = (grupoId: number, itemId: number) => {
    setExamGrupos((gs) =>
      gs.map((g) =>
        g.id === grupoId
          ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, urgencia: it.urgencia === "Urgente" ? "Rutina" : "Urgente" } : it)) }
          : g
      )
    );
  };

  const undoLast = () => {
    // Busca el ítem con mayor id (el último agregado) en toda la
    // pestaña, sin importar en qué receta haya quedado.
    let target: { grupoId: number; itemId: number } | null = null;
    let maxId = -1;
    gruposOfTab(tab).forEach((g) => {
      g.items.forEach((it) => {
        if (it.id > maxId) { maxId = it.id; target = { grupoId: g.id, itemId: it.id }; }
      });
    });
    if (target) removeItem(tab, target.grupoId, target.itemId);
  };

  /* ---------- campos del formulario / autocompletado ---------- */
  const updateField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === NAME_KEY_BY_TAB[tab]) renderSuggestions(value);
  };

  const renderSuggestions = (value: string) => {
    const q = value.trim().toLowerCase();
    if (!q) {
      setShowSuggestions(false);
      setFiltered([]);
      return;
    }
    const nameKey = NAME_KEY_BY_TAB[tab];
    const list = DB[tab].filter((d) => d[nameKey].toLowerCase().includes(q)).slice(0, 6);
    setFiltered(list);
    if (!list.length) {
      setShowSuggestions(false);
      return;
    }
    setHighlighted(0);
    setShowSuggestions(true);
  };

  const applySuggestion = (i: number) => {
    const entry = filtered[i];
    if (!entry) return;
    setDraft({ ...emptyDraftFor(tab), ...entry });
    setShowSuggestions(false);
  };

  const moveHighlight = (delta: number) => {
    if (!filtered.length) return;
    setHighlighted((h) => (h + delta + filtered.length) % filtered.length);
  };

  const onNameFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveHighlight(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); moveHighlight(-1); return; }
    if (e.key === "Tab" && showSuggestions) {
      applySuggestion(highlighted < 0 ? 0 : highlighted);
      return;
    }
    if (e.key === "Escape") {
      if (showSuggestions || draft[NAME_KEY_BY_TAB[tab]]) {
        e.stopPropagation();
        setShowSuggestions(false);
        updateField(NAME_KEY_BY_TAB[tab], "");
      }
      return;
    }
    onAnyFieldKeyDown(e);
  };

  const onAnyFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      attemptCommit();
    }
  };

  /* ---------- cambio de pestaña ---------- */
  const switchTab = (t: Tab) => {
    setTab(t);
    setDraft(emptyDraftFor(t));
    setShowSuggestions(false);
    setTimeout(() => fieldRefs.current[NAME_KEY_BY_TAB[t]]?.focus(), 0);
  };

  // La receta en preview/impresión-individual sigue por defecto a la
  // receta activa de cada categoría.
  useEffect(() => {
    setGrupoPreview(grupoActivoId[tab]);
  }, [tab, grupoActivoId]);

  /* ---------- cerrar drawer ---------- */
  const closeDrawer = () => {
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => fieldRefs.current[NAME_KEY_BY_TAB[tab]]?.focus(), 260);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* ---------- atajos de teclado ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") { closeDrawer(); }
      if (e.altKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        const t = (["medicamentos", "examenes", "formulas"] as Tab[])[Number(e.key) - 1];
        switchTab(t);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        const enUnCampo = activeTag === "input" || activeTag === "textarea" || activeTag === "select";
        if (!enUnCampo) { e.preventDefault(); undoLast(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab, medGrupos, examGrupos, formGrupos, draft, grupoActivoId]);

  /* ---------- impresión (solo con membrete, media carta) ----------
     Cada receta se imprime en un bloque fijo de 8.5in x 5.5in
     (media hoja carta). Al imprimir varias, se apilan de a dos por
     página porque 5.5in + 5.5in = 11in = alto de una hoja carta. */
  const handleImprimirUna = (grupoId: number) => {
    if (!gruposConItemsTab.length) return;
    setImprimir({ tab, grupoIds: [grupoId] });
  };

  const handleImprimirTodas = () => {
    const ids = gruposConItemsTab.map((g) => g.id);
    if (!ids.length) return;
    setImprimir({ tab, grupoIds: ids });
  };

  useEffect(() => {
    if (!imprimir) return;
    const t = setTimeout(() => window.print(), 50);
    return () => clearTimeout(t);
  }, [imprimir]);

  useEffect(() => {
    const onAfterPrint = () => setImprimir(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const handleChipClick = (label: string) => {
    const nameKey = NAME_KEY_BY_TAB[tab];
    const dbItem = DB[tab].find((d) => d[nameKey] === label);
    if (dbItem) commitValues({ ...emptyDraftFor(tab), ...dbItem });
  };

  /* ---------- render de línea del ticket ---------- */
  const renderTicketLine = (grupoId: number, it: AnyItem, i: number) => {
    let t1 = "";
    let t2 = "";
    if (tab === "medicamentos") {
      const med = it as MedItem;
      t1 = med.medicamento + (med.dosis ? " · " + med.dosis : "");
      const partes = [med.via_administracion, med.frecuencia, med.duracion, med.cantidad].filter(Boolean);
      t2 = partes.join(" · ");
      if (med.indicaciones) t2 += (t2 ? "  ·  " : "") + med.indicaciones;
      if (med.horario) t2 += (t2 ? "  ·  " : "") + "🕐 " + med.horario.join(" - ");
    } else if (tab === "examenes") {
      const ex = it as ExamItem;
      t1 = ex.nombre_examen;
      t2 = [ex.tipo_examen, ex.indicaciones_previas].filter(Boolean).join(" · ");
    } else {
      const f = it as FormItem;
      t1 = f.nombre_formula;
      t2 = [f.ingredientes, f.forma_farmaceutica, f.cantidad_preparar, f.via_administracion, f.indicaciones].filter(Boolean).join(" · ");
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
            className={cx(styles["urgency-badge"], styles[(it as ExamItem).urgencia.toLowerCase()])}
            onClick={() => toggleUrgency(grupoId, it.id)}
          >
            {(it as ExamItem).urgencia}
          </div>
        )}
        <button type="button" className={styles.rm} title="Eliminar" onClick={() => removeItem(tab, grupoId, it.id)}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    );
  };

  /* ---------- contenido de una receta para el membrete CMO ----------
     Compartido entre la vista previa en pantalla y la impresión final
     (una receta sola o todas apiladas) — mismo marcado siempre, para
     que lo que el doctor ve en pantalla sea lo que se imprime. */
  const renderSlip = (t: Tab, grupoId: number) => {
    const grupo = gruposOfTab(t).find((g) => g.id === grupoId);
    const items = grupo ? grupo.items : [];

    const header = (
      <div className={styles["cmo-rp-header"]}>
        <div className={styles["cmo-rp-header-name"]}><strong>Paciente:</strong> {pacienteNombre}</div>
        <div className={styles["cmo-rp-header-age"]}><strong>Edad:</strong> {pacienteEdad}</div>
      </div>
    );

    let body: React.ReactNode;

    if (t === "examenes") {
      const exs = items as ExamItem[];
      body = (
        <>
          {header}
          {exs.length ? exs.map((it, i) => (
            <div key={it.id} className={styles["cmo-rp-line"]}>
              {i + 1}. {it.nombre_examen}
              {it.urgencia === "Urgente" && <span className={styles["cmo-rp-meta"]}> — URGENTE</span>}
            </div>
          )) : <div className={styles["cmo-rp-line"]}>Sin exámenes</div>}
        </>
      );
    } else if (t === "medicamentos") {
      const meds = items as MedItem[];
      body = (
        <>
          {header}
          {meds.length ? meds.map((m, i) => {
            const instrucciones = [m.via_administracion, m.frecuencia, m.duracion].filter(Boolean).join(" · ");
            return (
              <div key={m.id} className={styles["cmo-rp-med-row"]}>
                <div className={styles["cmo-rp-med-col-left"]}>
                  <span className={styles["cmo-rp-num"]}>{i + 1}.</span>
                  <span className={styles["cmo-rp-med-name"]}>{m.medicamento}{m.dosis ? ` ${m.dosis}` : ""}</span>
                </div>
                <div className={styles["cmo-rp-med-col-right"]}>
                  {instrucciones && <div className={styles["cmo-rp-instrucciones"]}>{instrucciones}</div>}
                  {m.horario && m.horario.length > 0 && (
                    <div className={styles["cmo-rp-horario"]}>🕐 {m.horario.join(" · ")}</div>
                  )}
                </div>
              </div>
            );
          }) : <div className={styles["cmo-rp-line"]}>Sin medicamentos</div>}
        </>
      );
    } else {
      const forms = items as FormItem[];
      body = (
        <>
          {header}
          {forms.length ? forms.map((it, i) => {
            const meta = [it.ingredientes, it.forma_farmaceutica, it.via_administracion].filter(Boolean).join(" · ");
            return (
              <div key={it.id} className={styles["cmo-rp-line"]}>
                {i + 1}. {it.nombre_formula}
                {meta && <span className={styles["cmo-rp-meta"]}> — {meta}</span>}
              </div>
            );
          }) : <div className={styles["cmo-rp-line"]}>Sin fórmulas</div>}
        </>
      );
    }

    return (
      <>
        <div className={styles["cmo-rp"]}>{body}</div>
        {t === "examenes" && (
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
  };

  const tieneAlergias = Boolean(alergias && alergias.trim());

  /* ---------- render de un cuadro individual de la fila ---------- */
  const renderCampo = (f: FieldDef) => {
    const value = draft[f.key] ?? "";
    const isNameField = f.key === NAME_KEY_BY_TAB[tab];
    const commonProps = {
      id: `campo_${tab}_${f.key}`,
      ref: (el: HTMLInputElement | HTMLSelectElement | null) => { fieldRefs.current[f.key] = el; },
      value,
      className: cx(shakeField === f.key && styles.shakeField),
    };

    return (
      <div key={f.key} className={cx(styles.campo, styles[`w-${f.width}`], f.required && styles.required)}>
        <label htmlFor={`campo_${tab}_${f.key}`}>{f.label}</label>
        {isNameField ? (
          <div className={styles["campo-nombre-wrap"]}>
            <input
              {...commonProps}
              ref={(el) => { fieldRefs.current[f.key] = el; }}
              type="text"
              autoComplete="off"
              placeholder={f.placeholder}
              onChange={(e) => updateField(f.key, e.target.value)}
              onKeyDown={onNameFieldKeyDown}
            />
            {showSuggestions && (
              <div className={styles.suggestions}>
                {filtered.map((item, i) => (
                  <div
                    key={item[f.key]}
                    className={cx(styles["sugg-item"], i === highlighted && styles.hi)}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(i); }}
                  >
                    <span className={styles.name}>{item[f.key]}</span>
                    <span className={styles.preview}>
                      {[item.dosis, item.via_administracion, item.frecuencia, item.duracion, item.tipo_examen, item.ingredientes]
                        .filter(Boolean).slice(0, 2).join(" · ")}
                      <span className={styles["sugg-tabhint"]}>Tab</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : f.select ? (
          <select
            {...commonProps}
            ref={(el) => { fieldRefs.current[f.key] = el; }}
            onChange={(e) => updateField(f.key, e.target.value)}
            onKeyDown={onAnyFieldKeyDown}
          >
            {f.select.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            {...commonProps}
            ref={(el) => { fieldRefs.current[f.key] = el; }}
            type="text"
            list={f.datalist ? `datalist_${tab}_${f.key}` : undefined}
            placeholder={f.placeholder}
            onChange={(e) => updateField(f.key, e.target.value)}
            onKeyDown={onAnyFieldKeyDown}
          />
        )}
        {f.datalist && (
          <datalist id={`datalist_${tab}_${f.key}`}>
            {f.datalist.map((opt) => <option key={opt} value={opt} />)}
          </datalist>
        )}
      </div>
    );
  };

  return (
    <div className={styles["receta-widget"]} data-doctor={medicoNombre} data-ci={pacienteCi}>
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
                  <div className={styles["campo-grid"]}>
                    {FIELDS_BY_TAB[tab].map(renderCampo)}
                    <button type="button" className={cx(styles["icon-btn"], styles.primary, styles["add-btn"])} title="Agregar (Enter)" onClick={attemptCommit}>
                      <FontAwesomeIcon icon={faPlus} /> Agregar
                    </button>
                  </div>

                  <div className={styles["kbd-hints"]}>
                    <span><kbd>Tab</kbd> siguiente campo</span>
                    <span><kbd>Enter</kbd> agregar</span>
                    <span><kbd>↑↓</kbd> navegar sugerencias</span>
                    <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer última línea</span>
                  </div>
                </div>

                {(gruposOfTab(tab).find((g) => g.id === grupoActivoId[tab])?.items.length ?? 0) > 0 && (
                  <div className={styles["ticket-toolbar"]}>
                    <button type="button" className={styles["new-receta-btn"]} onClick={nuevaReceta}>
                      <FontAwesomeIcon icon={faPlus} /> Nueva receta
                    </button>
                  </div>
                )}

                <div className={styles.ticket}>
                  {totalItemsTab === 0 && gruposOfTab(tab).length === 1 ? (
                    <div className={styles["ticket-empty"]}>Aún no agregaste ninguna línea. Completa los campos de arriba o toca un frecuente.</div>
                  ) : (
                    gruposOfTab(tab).map((g, gi) => (
                      <React.Fragment key={g.id}>
                        {gruposOfTab(tab).length > 1 && (
                          <div className={styles["ticket-sep"]}>
                            <span>Receta {gi + 1}</span>
                            <button
                              type="button"
                              className={styles["ticket-sep-rm"]}
                              title="Eliminar esta receta"
                              onClick={() => eliminarReceta(tab, g.id)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        )}
                        {g.items.length === 0 ? (
                          <div className={styles["ticket-empty-grupo"]}>Sin ítems en esta receta</div>
                        ) : (
                          g.items.map((it, i) => renderTicketLine(g.id, it, i))
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.flabel}>
                  <FontAwesomeIcon icon={faNotesMedical} className={styles.ficon} />Indicaciones generales
                  <small>Enter la refleja en la vista previa</small>
                </div>
                <textarea
                  rows={3}
                  placeholder="Ej. Tomar abundante agua y reposo relativo por 48h..."
                  value={indicaciones}
                  onChange={(e) => setIndicaciones(e.target.value)}
                />
              </div>
            </div>

            {/* ================= VISTA PREVIA CMO ================= */}
            <div className={styles["paper-wrap"]}>
              {gruposOfTab(tab).length > 1 && (
                <div className={styles["receta-picker"]}>
                  <span className={styles["receta-picker-label"]}>Vista previa:</span>
                  {gruposOfTab(tab).map((g, gi) => (
                    <button
                      key={g.id}
                      type="button"
                      className={cx(styles["receta-picker-btn"], g.id === grupoPreview && styles.active)}
                      onClick={() => setGrupoPreview(g.id)}
                    >
                      Receta {gi + 1}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles["cmo-canvas"]}>
                <img src={RecetaImprimir} alt="Vista previa receta CMO" />
                {renderSlip(tab, grupoPreview)}
              </div>

              <div className={styles["print-actions"]}>
                <button
                  type="button"
                  className={styles["icon-btn"]}
                  disabled={!gruposConItemsTab.length}
                  onClick={() => handleImprimirUna(grupoPreview)}
                >
                  Imprimir esta receta
                </button>
                <button
                  type="button"
                  className={cx(styles["icon-btn"], styles.primary)}
                  disabled={!gruposConItemsTab.length}
                  onClick={handleImprimirTodas}
                >
                  Imprimir todo con membrete{gruposConItemsTab.length > 1 ? ` · ${gruposConItemsTab.length}` : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ÁREA DE IMPRESIÓN (solo existe mientras se imprime) =================
         Cada receta ocupa un bloque fijo de 8.5in x 5.5in (media
         carta). Dos bloques seguidos = 11in = una hoja carta completa,
         así que al imprimir varias recetas caen 2 por página sin
         configuración extra. */}
      {imprimir && (
        <div className={styles["cmo-print-all"]}>
          {imprimir.grupoIds.map((gid, i) => (
            <div
              key={gid}
              className={cx(styles["cmo-canvas"], styles["cmo-slip"])}
              style={i % 2 === 1 && i !== imprimir.grupoIds.length - 1 ? { breakAfter: "page" } : undefined}
            >
              <img src={RecetaImprimir} alt="Receta CMO" />
              {renderSlip(imprimir.tab, gid)}
            </div>
          ))}
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
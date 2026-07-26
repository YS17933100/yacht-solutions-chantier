"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Plus, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, X, Clock, Flag } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { categoryMeta, specialtyMeta, HOURS_PER_DAY } from "@/lib/constants";
import { getWorkDaysBetween, isTechnicianAbsent, canTechnicianDoTask, getShiftedTasks } from "@/lib/planning";
import Modal from "@/components/Modal";
import { FieldLabel, inputClass, PrimaryButton } from "@/components/FormFields";

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const ABSENCE_TYPES = [
  { id: 'conges', label: 'Congés' },
  { id: 'maladie', label: 'Arrêt maladie' },
  { id: 'indisponible', label: 'Non disponible' },
  { id: 'formation', label: 'Formation' },
];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function PlanningView({ onDataChange, defaultTab }) {
  const [boats, setBoats] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(defaultTab || 'planning'); // planning | absences | kpi

  const [showValidateModal, setShowValidateModal] = useState(null); // task object
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showTaskDateModal, setShowTaskDateModal] = useState(null); // task object
  const [showAssignModal, setShowAssignModal] = useState(null); // { techId, date }
  const [assignForm, setAssignForm] = useState({ taskId: '' });
  const [kpiPeriod, setKpiPeriod] = useState('mois');
  const [kpiDate, setKpiDate] = useState(() => new Date());

  const [validateForm, setValidateForm] = useState({ real_hours: '', status: 'termine' });
  const [absenceForm, setAbsenceForm] = useState({ technician_id: '', type: 'conges', start_date: '', end_date: '', note: '' });
  const [taskDateForm, setTaskDateForm] = useState({ planned_date: '', planned_end_date: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [boatRes, taskRes, techRes, absRes] = await Promise.all([
      supabase.from('boats').select('*').eq('archived', false),
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('technicians').select('*').order('created_at'),
      supabase.from('absences').select('*'),
    ]);
    setBoats(boatRes.data || []);
    setTasks(taskRes.data || []);
    setTechnicians(techRes.data || []);
    setAbsences(absRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Semaine courante — 5 jours ouvrés
  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = addDays(weekStart, i);
      return d.toISOString().split('T')[0];
    });
  }, [weekStart]);

  const today = new Date().toISOString().split('T')[0];

  // Planning calculé
  const planning = useMemo(() => {
    // Pour chaque technicien et chaque jour, quelles tâches ?
    // On filtre les tâches avec planned_date dans la semaine
    const result = {};
    technicians.forEach(tech => {
      result[tech.id] = {};
      weekDays.forEach(day => {
        const absent = isTechnicianAbsent(tech.id, day, absences);
        if (absent) {
          result[tech.id][day] = { type: 'absent' };
          return;
        }
        const dayTasks = tasks.filter(t => {
          if (!t.planned_date) return false;
          if (t.assigned_technician_id !== tech.id) return false;
          return t.planned_date === day;
        });
        result[tech.id][day] = { type: 'normal', tasks: dayTasks };
      });
    });
    return result;
  }, [technicians, weekDays, tasks, absences]);

  // Tâches décalées (non validées après leur date planifiée)
  const shiftedTasks = useMemo(() => getShiftedTasks(tasks, today), [tasks, today]);

  // Filtre par bateau
  const filteredBoatIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return boats.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.hull && b.hull.toLowerCase().includes(q))
    ).map(b => b.id);
  }, [search, boats]);

  function boatColor(boatId) {
    const colors = ['#1E2D4E','#2B4C8C','#3D5A4C','#8A6D3B','#C2622D','#5C5546'];
    const idx = boats.findIndex(b => b.id === boatId) % colors.length;
    return colors[Math.max(0, idx)];
  }

  function boatName(boatId) {
    const b = boats.find(x => x.id === boatId);
    return b ? `${b.name} ${b.hull || ''}`.trim() : '';
  }

  async function validateTask() {
    if (!showValidateModal) return;
    const currentWeekStart = new Date(weekStart.getTime());
    const { real_hours, status } = validateForm;
    await supabase.from('tasks').update({
      status: status,
      real_hours: real_hours ? parseFloat(real_hours) : null,
      validated_at: status === 'termine' ? new Date().toISOString() : null,
    }).eq('id', showValidateModal.id);
    setShowValidateModal(null);
    setValidateForm({ real_hours: '', status: 'termine' });
    await loadAll();
    // Restaurer la semaine APRÈS le rechargement
    setWeekStart(new Date(currentWeekStart.getTime()));
  }

  async function acceptShift() {
    const ids = shiftedTasks.map(t => t.id);
    for (const id of ids) {
      await supabase.from('tasks').update({ shift_accepted: true }).eq('id', id);
    }
    setShowShiftModal(false);
    loadAll();
  }

  async function saveAbsence() {
    if (!absenceForm.technician_id || !absenceForm.start_date || !absenceForm.end_date) return;
    await supabase.from('absences').insert(absenceForm);
    setAbsenceForm({ technician_id: '', type: 'conges', start_date: '', end_date: '', note: '' });
    setShowAbsenceModal(false);
    loadAll();
  }

  async function deleteAbsence(id) {
    await supabase.from('absences').delete().eq('id', id);
    loadAll();
  }

  async function generatePlanning() {
    const activeboats = boats.filter(b => b.intervention_start && b.intervention_end);
    if (activeboats.length === 0) {
      alert('Aucun bateau avec des dates d\'intervention. Renseigne les dates dans le Gantt ou l\'onglet Bateaux.');
      return;
    }

    let updated = 0;

    for (const boat of activeboats) {
      const workDays = [];
      const d = new Date(boat.intervention_start);
      const end = new Date(boat.intervention_end);
      while (d <= end) {
        const day = d.getDay();
        if (day >= 1 && day <= 5) {
          workDays.push(d.toISOString().split('T')[0]);
        }
        d.setDate(d.getDate() + 1);
      }

      // Tâches YS non terminées pour ce bateau
      const boatTasks = tasks.filter(t =>
        t.boat_id === boat.id &&
        t.provider === 'Yacht Solutions' &&
        t.status !== 'termine'
      ).sort((a, b) => {
        if (a.is_priority && !b.is_priority) return -1;
        if (!a.is_priority && b.is_priority) return 1;
        return 0;
      });

      // Regrouper par technicien assigné
      const techTasks = {};
      const unassigned = [];
      boatTasks.forEach(t => {
        if (t.assigned_technician_id) {
          if (!techTasks[t.assigned_technician_id]) techTasks[t.assigned_technician_id] = [];
          techTasks[t.assigned_technician_id].push(t);
        } else {
          unassigned.push(t);
        }
      });

      // Pour les non assignés, distribuer selon spécialité
      for (const task of unassigned) {
        const compatible = technicians.filter(t => {
          if (t.specialty === 'libre') return false;
          const catMap = { electricite: 'elec_plomb', plomberie: 'elec_plomb', menuiserie: 'menuiserie', accastillage: 'elec_plomb', autre: 'elec_plomb' };
          return catMap[task.category] === t.specialty;
        });
        if (compatible.length > 0) {
          // Choisir le moins chargé
          const chosen = compatible.reduce((min, t) => {
            const load = (techTasks[t.id] || []).reduce((s, x) => s + Number(x.hours || 0), 0);
            const minLoad = (techTasks[min.id] || []).reduce((s, x) => s + Number(x.hours || 0), 0);
            return load < minLoad ? t : min;
          });
          await supabase.from('tasks').update({ assigned_technician_id: chosen.id }).eq('id', task.id);
          if (!techTasks[chosen.id]) techTasks[chosen.id] = [];
          techTasks[chosen.id].push({ ...task, assigned_technician_id: chosen.id });
          updated++;
        }
      }

      // Planifier les dates pour chaque technicien
      for (const [techId, tList] of Object.entries(techTasks)) {
        const absent = absences.filter(a => a.technician_id === techId);
        let dayIdx = 0;
        let hoursUsedToday = 0;

        for (const task of tList) {
          let hoursLeft = Number(task.hours || 0);
          let startDate = null;

          while (hoursLeft > 0 && dayIdx < workDays.length) {
            const day = workDays[dayIdx];
            const isAbsent = absent.some(a => day >= a.start_date && day <= a.end_date);
            if (isAbsent) { dayIdx++; hoursUsedToday = 0; continue; }

            const available = 6 - hoursUsedToday;
            if (available <= 0) { dayIdx++; hoursUsedToday = 0; continue; }

            if (!startDate) startDate = day;
            const used = Math.min(hoursLeft, available);
            hoursLeft -= used;
            hoursUsedToday += used;
            if (hoursUsedToday >= 6) { dayIdx++; hoursUsedToday = 0; }
          }

          if (startDate) {
            await supabase.from('tasks').update({
              planned_date: startDate,
              assigned_technician_id: techId,
            }).eq('id', task.id);
            updated++;
          }
        }
      }
    }

    await loadAll();
    if (onDataChange) onDataChange();
    alert(`✓ Planning généré ! ${updated} articles planifiés.`);
  }

  async function assignTaskFromPlanning() {
    if (!showAssignModal || !assignForm.taskId) return;
    await supabase.from('tasks').update({
      assigned_technician_id: showAssignModal.techId,
      planned_date: showAssignModal.date,
    }).eq('id', assignForm.taskId);
    setShowAssignModal(null);
    setAssignForm({ taskId: '' });
    loadAll();
    if (onDataChange) onDataChange();
  }

  async function saveTaskDate() {
    if (!showTaskDateModal) return;
    await supabase.from('tasks').update({
      planned_date: taskDateForm.planned_date || null,
      planned_end_date: taskDateForm.planned_end_date || null,
    }).eq('id', showTaskDateModal.id);
    setShowTaskDateModal(null);
    loadAll();
  }

  // kpi calculé plus haut avec filtre période

  function shiftPeriod(date, period, dir) {
    const d = new Date(date);
    if (period === 'mois') d.setMonth(d.getMonth() + dir);
    else if (period === 'trimestre') d.setMonth(d.getMonth() + dir * 3);
    else d.setFullYear(d.getFullYear() + dir);
    return d;
  }

  function getPeriodRange(date, period) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (period === 'mois') {
      return {
        start: `${y}-${String(m+1).padStart(2,'0')}-01`,
        end: `${y}-${String(m+1).padStart(2,'0')}-${String(new Date(y,m+1,0).getDate()).padStart(2,'0')}`,
      };
    } else if (period === 'trimestre') {
      const q = Math.floor(m / 3);
      const startM = q * 3;
      const endM = startM + 2;
      return {
        start: `${y}-${String(startM+1).padStart(2,'0')}-01`,
        end: `${y}-${String(endM+1).padStart(2,'0')}-${String(new Date(y,endM+1,0).getDate()).padStart(2,'0')}`,
      };
    } else {
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
  }

  const kpiLabel = (() => {
    const d = kpiDate;
    const y = d.getFullYear();
    const m = d.getMonth();
    if (kpiPeriod === 'mois') return `${MONTHS[m]} ${y}`;
    if (kpiPeriod === 'trimestre') return `T${Math.floor(m/3)+1} ${y}`;
    return `Année ${y}`;
  })();

  const periodRange = getPeriodRange(kpiDate, kpiPeriod);

  // KPI filtrés par période
  const kpi = useMemo(() => {
    const ys = tasks.filter(t => t.provider === 'Yacht Solutions');
    // Tous les calculs filtrés par période
    const inPeriod = ys.filter(t => {
      const d = (t.validated_at || t.planned_date || t.created_at || '').substring(0, 10);
      return d >= periodRange.start && d <= periodRange.end;
    });
    const doneInPeriod = inPeriod.filter(t => t.status === 'termine');
    const withRealInPeriod = doneInPeriod.filter(t => t.real_hours != null);
    const overBudgetInPeriod = withRealInPeriod.filter(t => Number(t.real_hours) > Number(t.hours));
    const totalPlannedInPeriod = inPeriod.reduce((s, t) => s + Number(t.hours || 0), 0);
    const totalRealInPeriod = withRealInPeriod.reduce((s, t) => s + Number(t.real_hours || 0), 0);
    const totalPlannedDoneInPeriod = withRealInPeriod.reduce((s, t) => s + Number(t.hours || 0), 0);
    // Calcul heures disponibles = techniciens × jours ouvrés × 6h - absences
    const periodDays = kpiPeriod === 'mois' ? 20 : kpiPeriod === 'trimestre' ? 60 : 240;
    const nbTechs = technicians.filter(t => t.specialty !== 'libre').length || 1;
    // Jours d'absence dans la période
    const absenceDays = absences.reduce((total, abs) => {
      const start = new Date(Math.max(new Date(abs.start_date), new Date(periodRange.start)));
      const end = new Date(Math.min(new Date(abs.end_date), new Date(periodRange.end)));
      if (start > end) return total;
      let days = 0;
      const d = new Date(start);
      while (d <= end) {
        if (d.getDay() >= 1 && d.getDay() <= 5) days++;
        d.setDate(d.getDate() + 1);
      }
      return total + days;
    }, 0);
    const maxAvailableHours = Math.max(0, (periodDays * nbTechs - absenceDays) * 6);

    return {
      totalTasks: inPeriod.length,
      doneTasks: doneInPeriod.length,
      inPeriodTasks: inPeriod.length,
      doneRate: inPeriod.length ? Math.round(doneInPeriod.length / inPeriod.length * 100) : 0,
      overBudgetRate: withRealInPeriod.length ? Math.round(overBudgetInPeriod.length / withRealInPeriod.length * 100) : 0,
      totalPlanned: totalPlannedInPeriod,
      totalReal: totalRealInPeriod,
      efficiency: totalPlannedDoneInPeriod ? Math.round(totalRealInPeriod / totalPlannedDoneInPeriod * 100) : 0,
      maxAvailableHours,
    };
  }, [tasks, periodRange, technicians, absences, kpiPeriod]);

  if (loading) return <div className="flex items-center justify-center py-16 text-muted text-sm">Chargement du planning…</div>;

  return (
    <div className="w-full">
      {/* Tabs - cachés en mode KPI */}
      <div className="flex border-b border-border bg-paper" style={{ display: defaultTab === 'kpi' ? 'none' : 'flex' }}>
        {[
          { id: 'planning', label: 'Planning semaine' },
          { id: 'absences', label: `Absences (${absences.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide cursor-pointer bg-transparent border-none"
            style={{
              color: activeTab === tab.id ? '#1E2D4E' : '#7A8BA8',
              borderBottom: activeTab === tab.id ? '2px solid #D63B2F' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PLANNING TAB */}
      {activeTab === 'planning' && (
        <div className="p-4">
          {/* Alerte décalage */}
          {shiftedTasks.length > 0 && (
            <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-[13px] text-orange-700">
                <strong>{shiftedTasks.length} article(s) non validé(s)</strong> ont été décalés automatiquement.
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setShowShiftModal(true)}
                    className="px-3 py-1.5 text-[12px] font-semibold bg-orange-500 text-white rounded cursor-pointer border-none"
                  >
                    Voir et valider le décalage
                  </button>
                  <button
                    onClick={() => setActiveTab('planning')}
                    className="px-3 py-1.5 text-[12px] font-semibold bg-white text-orange-600 border border-orange-300 rounded cursor-pointer"
                  >
                    Modifier les dates d'intervention
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[150px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="w-full pl-8 pr-3 py-2 border border-border rounded text-[13px] bg-white text-inktext focus:outline-none focus:border-terracotta"
                placeholder="Filtrer par bateau ex: 127, L55…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWeekStart(prev => addDays(prev, -7))}
                className="border border-border rounded p-2 bg-white cursor-pointer hover:bg-cream text-inktext"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[12px] font-semibold text-inktext min-w-[160px] text-center">
                Sem. du {formatDate(weekDays[0])} au {formatDate(weekDays[4])}
              </span>
              <button
                onClick={() => setWeekStart(prev => addDays(prev, 7))}
                className="border border-border rounded p-2 bg-white cursor-pointer hover:bg-cream text-inktext"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <button
              onClick={() => setWeekStart(getMonday(new Date()))}
              className="text-[12px] font-semibold px-3 py-2 border border-border rounded bg-white cursor-pointer hover:bg-cream text-inktext"
            >
              Aujourd'hui
            </button>
            <button
              onClick={generatePlanning}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded cursor-pointer border-none text-white"
              style={{ background: '#D63B2F' }}
            >
              ⚡ Générer le planning
            </button>
          </div>

          {/* Grid planning */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr className="bg-cream border-b border-border">
                  <th className="text-left px-3 py-2 text-[11px] font-bold text-inktext border-r border-border sticky left-0 bg-cream" style={{ minWidth: 110 }}>
                    Technicien
                  </th>
                  {weekDays.map((day, i) => (
                    <th key={day} className="text-center text-[11px] font-bold py-2 px-1" style={{ minWidth: 110, color: day === today ? '#D63B2F' : '#1E2D4E' }}>
                      {WEEK_DAYS[i]} {formatDate(day)}
                      {day === today && <div className="text-[10px] font-normal text-terracotta">Aujourd'hui</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {technicians.map(tech => {
                  const meta = specialtyMeta(tech.specialty);
                  return (
                    <tr key={tech.id} className="border-b border-border">
                      <td className="px-3 py-2 border-r border-border sticky left-0 bg-paper" style={{ minWidth: 110 }}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: meta.color }}>
                            {tech.name[0]}
                          </div>
                          <div>
                            <div className="text-[12px] font-bold text-inktext">{tech.name}</div>
                            <div className="text-[10px] text-muted">{meta.label.split(' / ')[0]}</div>
                          </div>
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const cell = planning[tech.id]?.[day];
                        if (!cell) return <td key={day} className="p-1" style={{ minWidth: 110 }}><div className="rounded bg-cream h-14" /></td>;

                        if (cell.type === 'absent') {
                          return (
                            <td key={day} className="p-1" style={{ minWidth: 110 }}>
                              <div className="rounded h-14 flex items-center justify-center text-[10px] text-muted font-semibold" style={{ background: 'repeating-linear-gradient(45deg,#F5F7FA,#F5F7FA 4px,#D0D8E8 4px,#D0D8E8 8px)' }}>
                                Absent
                              </div>
                            </td>
                          );
                        }

                        const dayTasks = (cell.tasks || []).filter(t => {
                          if (filteredBoatIds && !filteredBoatIds.includes(t.boat_id)) return false;
                          return true;
                        });

                        if (dayTasks.length === 0) {
                          return (
                            <td key={day} className="p-1" style={{ minWidth: 110 }}>
                              <div
                                className="rounded h-14 flex items-center justify-center cursor-pointer group"
                                style={{ background: '#F5F7FA', border: '1px dashed transparent' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#D0D8E8'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                                onClick={() => { setAssignForm({ taskId: '' }); setShowAssignModal({ techId: tech.id, date: day }); }}
                              >
                                <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">+ Assigner</span>
                              </div>
                            </td>
                          );
                        }

                        const isShifted = dayTasks.some(t => shiftedTasks.find(s => s.id === t.id));

                        return (
                          <td key={day} className="p-1" style={{ minWidth: 110 }}>
                            {dayTasks.map(task => {
                              const isValidated = task.status === 'termine';
                              const isOver = task.real_hours && Number(task.real_hours) > Number(task.hours);
                              const isUnder = task.real_hours && Number(task.real_hours) <= Number(task.hours);
                              const isShiftedTask = shiftedTasks.find(s => s.id === task.id);
                              const bColor = boatColor(task.boat_id);

                              return (
                                <div
                                  key={task.id}
                                  onClick={() => {
                                    setValidateForm({ real_hours: String(task.real_hours || task.hours || ''), status: task.status || 'termine' });
                                    setShowValidateModal(task);
                                  }}
                                  className="rounded mb-1 px-2 py-1.5 cursor-pointer text-[10px] relative"
                                  style={{
                                    background: isValidated ? '#2e7d32' : isShiftedTask ? '#fff3e0' : bColor,
                                    border: isShiftedTask && !isValidated ? '2px dashed #e65100' : 'none',
                                    minHeight: 48,
                                  }}
                                >
                                  {isValidated && (
                                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-white text-[9px]">✓</div>
                                  )}
                                  {isShiftedTask && !isValidated && (
                                    <div className="absolute top-1 right-1 text-orange-500 text-[9px] font-bold">↷</div>
                                  )}
                                  {task.is_priority && (
                                    <div className="absolute top-1 left-1 text-yellow-300 text-[9px]">⚑</div>
                                  )}
                                  <div className="font-bold" style={{ color: isShiftedTask && !isValidated ? '#e65100' : 'white' }}>
                                    {boatName(task.boat_id).substring(0, 10)}
                                  </div>
                                  <div style={{ color: isValidated ? 'rgba(255,255,255,0.8)' : isShiftedTask ? '#bf360c' : 'rgba(255,255,255,0.8)' }}>
                                    {task.name.substring(0, 18)}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1" style={{ color: isValidated ? 'rgba(255,255,255,0.7)' : isShiftedTask ? '#e65100' : 'rgba(255,255,255,0.6)' }}>
                                    {task.hours}h
                                    {isValidated && task.real_hours && (
                                      <span className={`ml-1 px-1 rounded text-[9px] font-bold ${isOver ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                                        → {task.real_hours}h {isOver ? '▲' : '✓'}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); setTaskDateForm({ planned_date: task.planned_date || '', planned_end_date: task.planned_end_date || '' }); setShowTaskDateModal(task); }}
                                    className="absolute bottom-1 right-1 text-[9px] bg-white/20 px-1 rounded cursor-pointer border-none text-white"
                                  >
                                    ✎
                                  </button>
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="flex gap-4 mt-3 flex-wrap text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#2e7d32', display: 'inline-block' }} /> Validé</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-orange-400" style={{ background: '#fff3e0', display: 'inline-block' }} /> Décalé</span>
            <span className="flex items-center gap-1.5"><span style={{ fontSize: 12 }}>⚑</span> Priorité avant mise à l'eau</span>
            <span className="flex items-center gap-1.5"><span className="font-bold text-green-700">✓</span> Heures réelles OK</span>
            <span className="flex items-center gap-1.5"><span className="font-bold text-red-600">▲</span> Dépassement heures</span>
            <span className="ml-auto text-[11px]">Cliquer sur une tâche pour valider · ✎ pour modifier la date</span>
          </div>
        </div>
      )}

      {/* ABSENCES TAB */}
      {activeTab === 'absences' && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-[14px] font-bold text-inktext">Absences & congés</div>
            <button
              onClick={() => setShowAbsenceModal(true)}
              className="flex items-center gap-1.5 bg-ink text-white border-none rounded px-3 py-2 text-[12px] font-semibold cursor-pointer"
            >
              <Plus size={13} /> Ajouter une absence
            </button>
          </div>

          {absences.length === 0 && (
            <div className="text-center py-12 text-muted text-sm italic">Aucune absence enregistrée.</div>
          )}

          <div className="flex flex-col gap-3">
            {absences.map(abs => {
              const tech = technicians.find(t => t.id === abs.technician_id);
              const meta = tech ? specialtyMeta(tech.specialty) : null;
              const type = ABSENCE_TYPES.find(t => t.id === abs.type);
              return (
                <div key={abs.id} className="bg-paper border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                  {tech && (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: meta?.color }}>
                      {tech.name[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-inktext">{tech?.name}</div>
                    <div className="text-[11px] text-muted">{type?.label} · {formatDate(abs.start_date)} → {formatDate(abs.end_date)}</div>
                    {abs.note && <div className="text-[11px] text-mutedtext italic mt-0.5">{abs.note}</div>}
                  </div>
                  <button onClick={() => deleteAbsence(abs.id)} className="text-terracottadark bg-transparent border-none cursor-pointer p-1">
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI TAB */}
      {activeTab === 'kpi' && (
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="text-[14px] font-bold text-inktext">KPI de production</div>
            <div className="flex rounded overflow-hidden border border-border ml-auto">
              {['mois', 'trimestre', 'annee'].map(p => (
                <button key={p} onClick={() => setKpiPeriod(p)} className="px-3 py-1.5 text-[11px] font-semibold cursor-pointer border-none"
                  style={{ background: kpiPeriod === p ? '#1E2D4E' : 'white', color: kpiPeriod === p ? 'white' : '#1E2D4E' }}>
                  {p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setKpiDate(prev => shiftPeriod(prev, kpiPeriod, -1))} className="border border-border rounded px-2 py-1.5 bg-white cursor-pointer text-inktext text-[12px]">‹</button>
              <span className="text-[12px] font-bold text-inktext min-w-[120px] text-center">{kpiLabel}</span>
              <button onClick={() => setKpiDate(prev => shiftPeriod(prev, kpiPeriod, 1))} className="border border-border rounded px-2 py-1.5 bg-white cursor-pointer text-inktext text-[12px]">›</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {/* Carte 1 - Articles terminés */}
            <div className="bg-paper border border-border rounded-lg p-3 text-center relative group cursor-help">
              <div className="text-[28px] font-semibold" style={{ color: '#1E2D4E' }}>{kpi.doneRate}%</div>
              <div className="text-[11px] text-muted mt-1">Articles terminés</div>
              <div className="text-[11px] font-semibold text-mutedtext">{kpi.doneTasks} / {kpi.totalTasks} articles</div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-inktext text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-left shadow-lg">
                Pourcentage d&apos;articles Yacht Solutions validés sur le total des articles de la période {kpiLabel}.
              </div>
            </div>

            {/* Carte 2 - Articles sur la période */}
            <div className="bg-paper border border-border rounded-lg p-3 text-center relative group cursor-help">
              <div className="text-[28px] font-semibold" style={{ color: '#1E2D4E' }}>{kpi.inPeriodTasks}</div>
              <div className="text-[11px] text-muted mt-1">Articles sur la période</div>
              <div className="text-[11px] font-semibold text-mutedtext">{kpiLabel}</div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-inktext text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-left shadow-lg">
                Nombre total d&apos;articles planifiés ou créés durant la période sélectionnée. Indique le volume de travail de la période.
              </div>
            </div>

            {/* Carte 3 - Dépassement */}
            <div className="bg-paper border border-border rounded-lg p-3 text-center relative group cursor-help">
              <div className="text-[28px] font-semibold" style={{ color: kpi.overBudgetRate > 20 ? '#D63B2F' : '#2e7d32' }}>{kpi.overBudgetRate}%</div>
              <div className="text-[11px] text-muted mt-1">Articles en dépassement</div>
              <div className="text-[11px] font-semibold" style={{ color: kpi.overBudgetRate > 20 ? '#D63B2F' : '#2e7d32' }}>
                {kpi.overBudgetRate > 20 ? '▲ À surveiller' : '✓ Bon niveau'}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-inktext text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-left shadow-lg">
                % d&apos;articles où les heures réelles dépassent les heures prévues.
                {kpi.overBudgetRate > 20 ? ' ▲ Action requise : organisez un point avec votre équipe pour revoir les estimations d\'heures sur les articles concernés et ajuster les prévisions futures.' : ' ✓ Vos estimations sont fiables.'}
              </div>
            </div>

            {/* Carte 4 - Heures planifiées / disponibles */}
            <div className="bg-paper border border-border rounded-lg p-3 text-center relative group cursor-help">
              <div className="text-[24px] font-semibold" style={{ color: '#1E2D4E' }}>{kpi.totalPlanned}h</div>
              <div className="text-[10px] text-muted mt-0.5">planifiées</div>
              <div className="text-[11px] font-semibold mt-1" style={{ color: kpi.totalPlanned > kpi.maxAvailableHours ? '#D63B2F' : '#2e7d32' }}>
                / {kpi.maxAvailableHours}h dispo
              </div>
              <div className="text-[10px] text-muted">capacité équipe {kpiLabel}</div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-inktext text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-left shadow-lg">
                Heures planifiées vs capacité maximale de l&apos;équipe sur la période (jours ouvrés × 6h × nombre de techniciens), déduit des absences enregistrées. Si planifiées &gt; dispo, l&apos;équipe est surchargée.
              </div>
            </div>

            {/* Carte 5 - Efficacité en heures */}
            <div className="bg-paper border border-border rounded-lg p-3 text-center relative group cursor-help">
              <div className="text-[22px] font-semibold" style={{ color: kpi.totalReal > kpi.totalPlanned && kpi.totalReal > 0 ? '#D63B2F' : kpi.totalReal > 0 ? '#2e7d32' : '#7A8BA8' }}>
                {kpi.totalReal > 0 ? `${kpi.totalReal}h` : '—'}
              </div>
              <div className="text-[10px] text-muted mt-0.5">heures réelles</div>
              <div className="text-[11px] font-semibold mt-1 text-mutedtext">
                {kpi.totalPlanned > 0 ? `/ ${kpi.totalPlanned}h prévues` : 'aucune prévision'}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-inktext text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-left shadow-lg">
                Heures réellement passées vs heures prévues. Si réel &lt; prévu : votre équipe est plus rapide que les estimations. Si réel &gt; prévu : des dépassements ont eu lieu, revoyez vos estimations. Affiche — si aucune heure réelle n&apos;a encore été saisie lors des validations.
              </div>
            </div>
          </div>

          <div className="text-[12px] font-bold text-inktext mb-3">Occupation par technicien — {kpiLabel}</div>
          <div className="flex flex-col gap-2">
            {technicians.map(tech => {
              const meta = specialtyMeta(tech.specialty);
              const capacityTarget = tech.capacity_target || 100;
              const assignedTasks = tasks.filter(t => {
                if (t.assigned_technician_id !== tech.id) return false;
                if (t.provider !== 'Yacht Solutions') return false;
                const d = (t.validated_at || t.planned_date || t.created_at || '').substring(0, 10);
                return d >= periodRange.start && d <= periodRange.end;
              });
              const totalHours = assignedTasks.reduce((s, t) => s + Number(t.hours || 0), 0);
              const periodDays = kpiPeriod === 'mois' ? 20 : kpiPeriod === 'trimestre' ? 60 : 240;
              // Capacité réelle (100%) et capacité cible
              const fullCapacity = periodDays * 6;
              const targetCapacity = periodDays * 6 * (capacityTarget / 100);
              const realRate = Math.min(120, fullCapacity > 0 ? Math.round(totalHours / fullCapacity * 100) : 0);
              const vsTarget = targetCapacity > 0 ? Math.round(totalHours / targetCapacity * 100) : 0;
              const isOverTarget = vsTarget > 100;
              return (
                <div key={tech.id} className="bg-paper border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: meta.color }}>
                      {tech.name[0]}
                    </div>
                    <span className="text-[12px] font-semibold text-inktext flex-1">{tech.name}</span>
                    {capacityTarget < 100 && (
                      <span className="text-[10px] text-orange-600 font-semibold bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                        Cible {capacityTarget}%
                      </span>
                    )}
                    <span className="text-[12px] font-bold" style={{ color: realRate > 90 ? '#1E2D4E' : '#7A8BA8' }}>
                      {realRate}% réel
                    </span>
                  </div>
                  {/* Barre occupation réelle */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-muted w-16">Occupation</span>
                    <div className="flex-1 bg-cream rounded h-3 overflow-hidden">
                      <div className="h-3 rounded transition-all" style={{ width: `${Math.min(100, realRate)}%`, background: realRate > 80 ? '#1E2D4E' : '#2B4C8C' }} />
                    </div>
                    <span className="text-[11px] font-bold text-inktext w-8 text-right">{realRate}%</span>
                  </div>
                  {/* Barre vs cible (uniquement si cible < 100%) */}
                  {capacityTarget < 100 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-16">Vs cible</span>
                      <div className="flex-1 bg-cream rounded h-3 overflow-hidden">
                        <div className="h-3 rounded transition-all" style={{ width: `${Math.min(100, vsTarget)}%`, background: isOverTarget ? '#D63B2F' : '#2e7d32' }} />
                      </div>
                      <span className="text-[11px] font-bold w-8 text-right" style={{ color: isOverTarget ? '#D63B2F' : '#2e7d32' }}>
                        {vsTarget}%
                      </span>
                      <span className="text-[10px]" style={{ color: isOverTarget ? '#D63B2F' : '#2e7d32' }}>
                        {isOverTarget ? '▲ dépasse la cible' : '✓ dans la cible'}
                      </span>
                    </div>
                  )}
                  <div className="text-[10px] text-muted mt-1">{totalHours}h planifiées · {assignedTasks.length} articles</div>
                </div>
              );
            })}
          </div>

          {/* KPI par bateau */}
          <div className="text-[12px] font-bold text-inktext mb-3 mt-6">Avancement par bateau</div>
          <div className="flex flex-col gap-2">
            {boats.map(boat => {
              const boatTasks = tasks.filter(t => t.boat_id === boat.id && t.provider === 'Yacht Solutions');
              if (boatTasks.length === 0) return null;
              const done = boatTasks.filter(t => t.status === 'termine').length;
              const progress = Math.round(done / boatTasks.length * 100);
              return (
                <div key={boat.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-inktext truncate">{boat.name} {boat.hull}</div>
                    <div className="text-[10px] text-muted">{done}/{boatTasks.length} articles validés</div>
                  </div>
                  <div className="flex items-center gap-2" style={{ minWidth: 140 }}>
                    <div className="flex-1 bg-cream rounded h-3 overflow-hidden">
                      <div className="h-3 rounded" style={{ width: `${progress}%`, background: progress === 100 ? '#2e7d32' : progress > 50 ? '#1E2D4E' : '#D63B2F' }} />
                    </div>
                    <span className="text-[12px] font-bold min-w-[36px] text-right" style={{ color: progress === 100 ? '#2e7d32' : progress > 50 ? '#1E2D4E' : '#D63B2F' }}>{progress}%</span>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* MODAL — Valider un article */}
      {showValidateModal && (
        <Modal title={`Valider — ${showValidateModal.name}`} onClose={() => setShowValidateModal(null)}>
          <div className="mb-3">
            <FieldLabel>Bateau</FieldLabel>
            <div className="text-[13px] font-semibold text-inktext">{boatName(showValidateModal.boat_id)}</div>
          </div>
          <div className="mb-3">
            <FieldLabel>Heures prévues</FieldLabel>
            <div className="text-[13px] text-inktext">{showValidateModal.hours}h</div>
          </div>
          <div className="mb-3">
            <FieldLabel>Heures réelles passées</FieldLabel>
            <select className={inputClass} value={validateForm.real_hours} onChange={e => setValidateForm(f => ({ ...f, real_hours: e.target.value }))}>
              <option value="">Non renseigné</option>
              {[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,9,10,11,12].map(h => (
                <option key={h} value={h}>{h}h{Number(h) > Number(showValidateModal.hours) ? ' ▲ dépassement' : Number(h) === Number(showValidateModal.hours) ? ' ✓' : ' ↓ sous budget'}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <FieldLabel>Statut</FieldLabel>
            <select className={inputClass} value={validateForm.status} onChange={e => setValidateForm(f => ({ ...f, status: e.target.value }))}>
              <option value="termine">Terminé ✓</option>
              <option value="en_cours">En cours ⏳</option>
              <option value="a_faire">À faire ○</option>
            </select>
          </div>
          {validateForm.real_hours && (
            <div className={`mb-4 px-3 py-2 rounded text-[12px] font-semibold ${Number(validateForm.real_hours) > Number(showValidateModal.hours) ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {Number(validateForm.real_hours) > Number(showValidateModal.hours)
                ? `▲ Dépassement de ${(Number(validateForm.real_hours) - Number(showValidateModal.hours)).toFixed(1)}h`
                : `✓ Dans les temps (${(Number(showValidateModal.hours) - Number(validateForm.real_hours)).toFixed(1)}h de marge)`
              }
            </div>
          )}
          {showValidateModal.status === 'termine' && (
            <div className="mb-3 px-3 py-2 rounded text-[12px] bg-orange-50 text-orange-700 border border-orange-200">
              ℹ️ Cet article est déjà validé. Tu peux modifier son statut ci-dessus pour corriger une erreur.
            </div>
          )}
          <PrimaryButton onClick={validateTask} className="w-full">
            {showValidateModal.status === 'termine' ? 'Modifier le statut' : 'Valider l\'article'}
          </PrimaryButton>
        </Modal>
      )}

      {/* MODAL — Décalage planning */}
      {showShiftModal && (
        <Modal title="Articles décalés — planning glissant" onClose={() => setShowShiftModal(false)}>
          <p className="text-[13px] text-muted mb-4">
            Ces articles n'ont pas été validés à leur date prévue. Que souhaitez-vous faire ?
          </p>
          <div className="flex flex-col gap-2 mb-5">
            {shiftedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-inktext">{task.name}</div>
                  <div className="text-[11px] text-muted">{boatName(task.boat_id)} · prévu le {formatDate(task.planned_date)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <PrimaryButton onClick={acceptShift} className="w-full">
              ✓ Accepter le décalage — reporter au lendemain
            </PrimaryButton>
            <button
              onClick={() => { setShowShiftModal(false); setActiveTab('planning'); }}
              className="w-full py-2.5 text-[13px] font-semibold border border-inktext text-inktext rounded cursor-pointer bg-transparent"
            >
              Modifier les dates d'intervention manuellement
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL — Modifier date d'un article */}
      {showTaskDateModal && (
        <Modal title={`Modifier la date — ${showTaskDateModal.name}`} onClose={() => setShowTaskDateModal(null)}>
          <p className="text-[12px] text-muted mb-4">Tu peux forcer une date précise pour cet article, indépendamment du planning automatique.</p>
          <div className="mb-3">
            <FieldLabel>Date de début planifiée</FieldLabel>
            <input type="date" className={inputClass} value={taskDateForm.planned_date} onChange={e => setTaskDateForm(f => ({ ...f, planned_date: e.target.value }))} />
          </div>
          <div className="mb-4">
            <FieldLabel>Date de fin planifiée</FieldLabel>
            <input type="date" className={inputClass} value={taskDateForm.planned_end_date} onChange={e => setTaskDateForm(f => ({ ...f, planned_end_date: e.target.value }))} />
          </div>
          <PrimaryButton onClick={saveTaskDate} className="w-full">Enregistrer</PrimaryButton>
        </Modal>
      )}

      {/* MODAL — Assigner un article depuis le planning */}
      {showAssignModal && (
        <Modal title={`Assigner un article — ${formatDate(showAssignModal.date)}`} onClose={() => setShowAssignModal(null)}>
          <p className="text-[12px] text-muted mb-4">
            Technicien : <strong className="text-inktext">{technicians.find(t => t.id === showAssignModal.techId)?.name}</strong>
          </p>
          <div className="mb-4">
            <FieldLabel>Choisir l'article à planifier</FieldLabel>
            <select
              className={inputClass}
              value={assignForm.taskId}
              onChange={e => setAssignForm({ taskId: e.target.value })}
            >
              <option value="">— Sélectionner un article —</option>
              {tasks
                .filter(t => t.provider === 'Yacht Solutions' && t.status !== 'termine')
                .map(t => {
                  const b = boats.find(b => b.id === t.boat_id);
                  return (
                    <option key={t.id} value={t.id}>
                      {b ? `${b.name} ${b.hull || ''}` : '?'} — {t.name} ({t.hours}h)
                    </option>
                  );
                })
              }
            </select>
          </div>
          <PrimaryButton onClick={assignTaskFromPlanning} className="w-full">Assigner</PrimaryButton>
        </Modal>
      )}

      {/* MODAL — Absence */}
      {showAbsenceModal && (
        <Modal title="Ajouter une absence" onClose={() => setShowAbsenceModal(false)}>
          <div className="mb-3">
            <FieldLabel>Technicien</FieldLabel>
            <select className={inputClass} value={absenceForm.technician_id} onChange={e => setAbsenceForm(f => ({ ...f, technician_id: e.target.value }))}>
              <option value="">Choisir…</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <FieldLabel>Type</FieldLabel>
            <select className={inputClass} value={absenceForm.type} onChange={e => setAbsenceForm(f => ({ ...f, type: e.target.value }))}>
              {ABSENCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <FieldLabel>Date de début</FieldLabel>
            <input type="date" className={inputClass} value={absenceForm.start_date} onChange={e => setAbsenceForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="mb-3">
            <FieldLabel>Date de fin</FieldLabel>
            <input type="date" className={inputClass} value={absenceForm.end_date} onChange={e => setAbsenceForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div className="mb-4">
            <FieldLabel>Note (optionnel)</FieldLabel>
            <input className={inputClass} value={absenceForm.note} onChange={e => setAbsenceForm(f => ({ ...f, note: e.target.value }))} placeholder="Ex. Congés été" />
          </div>
          <PrimaryButton onClick={saveAbsence} className="w-full">Enregistrer</PrimaryButton>
        </Modal>
      )}
    </div>
  );
}

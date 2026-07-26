"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import { FieldLabel, inputClass, PrimaryButton } from "@/components/FormFields";

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function TechnicianView({ techId, techName }) {
  const [tasks, setTasks] = useState([]);
  const [boats, setBoats] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ type: 'conges', start_date: '', end_date: '', note: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [taskRes, boatRes, absRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('assigned_technician_id', techId),
      supabase.from('boats').select('*').eq('archived', false),
      supabase.from('absences').select('*').eq('technician_id', techId),
    ]);
    setTasks(taskRes.data || []);
    setBoats(boatRes.data || []);
    setAbsences(absRes.data || []);
    setLoading(false);
  }, [techId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const d = addDays(weekStart, i);
    return d.toISOString().split('T')[0];
  }), [weekStart]);

  const today = new Date().toISOString().split('T')[0];

  // Taux d'occupation semaine
  const weekOccupation = useMemo(() => {
    const workedDays = weekDays.filter(d => tasks.some(t => t.planned_date === d)).length;
    return Math.round(workedDays / 5 * 100);
  }, [weekDays, tasks]);

  // Taux d'occupation mois
  const monthOccupation = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const workDays = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, m, i + 1);
      return d.getDay() >= 1 && d.getDay() <= 5;
    }).filter(Boolean).length;
    const workedDays = tasks.filter(t => {
      if (!t.planned_date) return false;
      const tp = new Date(t.planned_date);
      return tp.getFullYear() === y && tp.getMonth() === m;
    }).length;
    return workDays > 0 ? Math.round(workedDays / workDays * 100) : 0;
  }, [tasks]);

  function boatName(boatId) {
    const b = boats.find(x => x.id === boatId);
    return b ? `${b.name} ${b.hull || ''}`.trim() : '?';
  }

  function boatColor(boatId) {
    const colors = ['#1E2D4E','#2B4C8C','#3D5A4C','#8A6D3B','#D63B2F','#5C5546'];
    const idx = boats.findIndex(b => b.id === boatId) % colors.length;
    return colors[Math.max(0, idx)];
  }

  async function addAbsence() {
    if (!absenceForm.start_date || !absenceForm.end_date) return;
    await supabase.from('absences').insert({ ...absenceForm, technician_id: techId });
    setShowAbsenceModal(false);
    setAbsenceForm({ type: 'conges', start_date: '', end_date: '', note: '' });
    loadAll();
  }

  async function deleteAbsence(id) {
    await supabase.from('absences').delete().eq('id', id);
    loadAll();
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted text-sm">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Occupation */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-paper border border-border rounded-lg p-4 text-center">
          <div className="text-[28px] font-bold" style={{ color: weekOccupation > 80 ? '#1E2D4E' : weekOccupation > 40 ? '#2B4C8C' : '#D63B2F' }}>{weekOccupation}%</div>
          <div className="text-[12px] text-muted mt-1">Occupation cette semaine</div>
        </div>
        <div className="bg-paper border border-border rounded-lg p-4 text-center">
          <div className="text-[28px] font-bold" style={{ color: monthOccupation > 80 ? '#1E2D4E' : monthOccupation > 40 ? '#2B4C8C' : '#D63B2F' }}>{monthOccupation}%</div>
          <div className="text-[12px] text-muted mt-1">Occupation ce mois</div>
        </div>
      </div>

      {/* Planning semaine */}
      <div className="bg-paper border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <span className="text-[13px] font-bold text-inktext">Mon planning</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => setWeekStart(prev => addDays(prev, -7))} className="border border-border rounded p-1.5 bg-white cursor-pointer"><ChevronLeft size={13} /></button>
            <span className="text-[11px] font-semibold text-inktext min-w-[130px] text-center">
              {formatDate(weekDays[0])} — {formatDate(weekDays[4])}
            </span>
            <button onClick={() => setWeekStart(prev => addDays(prev, 7))} className="border border-border rounded p-1.5 bg-white cursor-pointer"><ChevronRight size={13} /></button>
            <button onClick={() => setWeekStart(getMonday(new Date()))} className="text-[11px] font-semibold px-2 py-1.5 border border-border rounded bg-white cursor-pointer text-inktext ml-1">Aujourd'hui</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 500 }}>
            <thead>
              <tr className="bg-cream border-b border-border">
                {weekDays.map((day, i) => (
                  <th key={day} className="text-center text-[11px] font-bold py-2 px-1" style={{ color: day === today ? '#D63B2F' : '#1E2D4E' }}>
                    {WEEK_DAYS[i]} {formatDate(day)}
                    {day === today && <div className="text-[9px] font-normal">Aujourd'hui</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDays.map(day => {
                  const isAbsent = absences.some(a => day >= a.start_date && day <= a.end_date);
                  const dayTasks = tasks.filter(t => t.planned_date === day);
                  return (
                    <td key={day} className="p-1 align-top" style={{ minWidth: 100, height: 80 }}>
                      {isAbsent ? (
                        <div className="rounded h-full flex items-center justify-center text-[10px] text-muted font-semibold" style={{ background: 'repeating-linear-gradient(45deg,#F5F7FA,#F5F7FA 4px,#D0D8E8 4px,#D0D8E8 8px)', minHeight: 60 }}>Absent</div>
                      ) : dayTasks.length === 0 ? (
                        <div className="rounded bg-cream h-full" style={{ minHeight: 60 }} />
                      ) : (
                        dayTasks.map(task => (
                          <div key={task.id} className="rounded mb-1 px-2 py-1.5 text-[10px]" style={{ background: task.status === 'termine' ? '#2e7d32' : boatColor(task.boat_id) }}>
                            <div className="font-bold text-white">{boatName(task.boat_id)}</div>
                            <div className="text-white/80">{task.name?.substring(0, 20)}</div>
                            <div className="text-white/60">{task.hours}h · {task.status === 'termine' ? '✓' : task.status === 'en_cours' ? '⏳' : '○'}</div>
                          </div>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Absences */}
      <div className="bg-paper border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[13px] font-bold text-inktext">Mes absences</span>
          <button onClick={() => setShowAbsenceModal(true)} className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded border-none cursor-pointer" style={{ background: '#1E2D4E' }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>
        {absences.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted text-sm italic">Aucune absence enregistrée.</div>
        ) : (
          <div className="divide-y divide-border">
            {absences.map(abs => {
              const type = ABSENCE_TYPES.find(t => t.id === abs.type);
              return (
                <div key={abs.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-inktext">{type?.label}</div>
                    <div className="text-[11px] text-muted">{formatDate(abs.start_date)} → {formatDate(abs.end_date)}</div>
                    {abs.note && <div className="text-[11px] text-mutedtext italic">{abs.note}</div>}
                  </div>
                  <button onClick={() => deleteAbsence(abs.id)} className="text-terracottadark bg-transparent border-none cursor-pointer p-1"><X size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAbsenceModal && (
        <Modal title="Ajouter une absence" onClose={() => setShowAbsenceModal(false)}>
          <div className="mb-3"><FieldLabel>Type</FieldLabel>
            <select className={inputClass} value={absenceForm.type} onChange={e => setAbsenceForm(f => ({ ...f, type: e.target.value }))}>
              {ABSENCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="mb-3"><FieldLabel>Date de début</FieldLabel><input type="date" className={inputClass} value={absenceForm.start_date} onChange={e => setAbsenceForm(f => ({ ...f, start_date: e.target.value }))} /></div>
          <div className="mb-3"><FieldLabel>Date de fin</FieldLabel><input type="date" className={inputClass} value={absenceForm.end_date} onChange={e => setAbsenceForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          <div className="mb-4"><FieldLabel>Note (optionnel)</FieldLabel><input className={inputClass} value={absenceForm.note} onChange={e => setAbsenceForm(f => ({ ...f, note: e.target.value }))} placeholder="Ex. Congés été" /></div>
          <PrimaryButton onClick={addAbsence} className="w-full">Enregistrer</PrimaryButton>
        </Modal>
      )}
    </div>
  );
}

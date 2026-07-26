"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Archive, ArchiveRestore, Search, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { FieldLabel, inputClass, PrimaryButton } from "@/components/FormFields";

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function dateStr(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg w-full max-w-md border border-gray-200" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-bold text-[#1E2D4E]">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-lg">✕</button>
        </div>
        <div className="p-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>{children}</div>
      </div>
    </div>
  );
}

export default function GanttView({ onBoatChange }) {
  const [boats, setBoats] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [settings, setSettings] = useState({ presence_color: '#1565C0', intervention_color: '#E65100' });
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'quarter'
  const [weekOffset, setWeekOffset] = useState(0); // nombre de semaines de décalage en mode mois
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [showBoatModal, setShowBoatModal] = useState(false);
  const [showEventModal, setShowMilestoneModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [editingBoat, setEditingBoat] = useState(null);
  const [boatTab, setBoatTab] = useState('dates');

  const [boatForm, setBoatForm] = useState({ name:'', hull:'', arrival_date:'', departure_date:'', launch_date:'', haulout_date:'', intervention_start:'', intervention_end:'', note:'' });
  const [eventForm, setMilestoneForm] = useState({ boat_id:'', label:'', date:'', color:'#8A6D3B', note:'' });
  const [settingsForm, setSettingsForm] = useState({ presence_color:'#1565C0', intervention_color:'#E65100' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [boatRes, msRes, settRes] = await Promise.all([
      supabase.from('boats').select('*').order('created_at', { ascending: true }),
      supabase.from('milestones').select('*').order('date', { ascending: true }),
      supabase.from('settings').select('*'),
    ]);
    setBoats(boatRes.data || []);
    setMilestones(msRes.data || []);
    if (settRes.data) {
      const s = {};
      settRes.data.forEach(r => s[r.key] = r.value);
      setSettings(s);
      setSettingsForm({ presence_color: s.presence_color || '#1565C0', intervention_color: s.intervention_color || '#E65100' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function changeMonth(dir) {
    setWeekOffset(0);
    setCurrentDate(prev => {
      if (viewMode === 'quarter') {
        let q = Math.floor(prev.m / 3) + dir;
        let y = prev.y;
        if (q > 3) { q = 0; y++; }
        if (q < 0) { q = 3; y--; }
        return { y, m: q * 3 };
      }
      let m = prev.m + dir, y = prev.y;
      if (m > 11) { m = 0; y++; }
      if (m < 0) { m = 11; y--; }
      return { y, m };
    });
  }

  function changeWeek(dir) {
    setWeekOffset(prev => prev + dir);
  }

  // En mode mois avec navigation par semaine : on affiche 28 jours (4 semaines)
  function getWeekViewDays() {
    // Point de départ : lundi de la semaine courante du mois
    const startOfMonth = new Date(currentDate.y, currentDate.m, 1);
    const dayOfWeek = startOfMonth.getDay();
    const monday = new Date(startOfMonth);
    monday.setDate(startOfMonth.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 4 * 7);
    
    const days = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isMonthStart: d.getDate() === 1,
        isWeekStart: d.getDay() === 1,
      });
    }
    return days;
  }

  const weekViewDays = viewMode === 'month' ? getWeekViewDays() : [];
  const weekViewLabel = weekViewDays.length > 0 ? (() => {
    const first = weekViewDays[0];
    const last = weekViewDays[weekViewDays.length - 1];
    const firstMonth = MONTHS[first.month];
    const lastMonth = MONTHS[last.month];
    if (first.month === last.month) return `${firstMonth} ${first.year}`;
    return `${first.day} ${firstMonth} — ${last.day} ${lastMonth} ${last.year}`;
  })() : '';

  async function saveBoat() {
    const { name, arrival_date, departure_date } = boatForm;
    if (!name.trim() || !arrival_date || !departure_date) return;
    const data = {
      name: boatForm.name.trim(),
      hull: boatForm.hull.trim() || null,
      arrival_date: boatForm.arrival_date || null,
      departure_date: boatForm.departure_date || null,
      launch_date: boatForm.launch_date || null,
      haulout_date: boatForm.haulout_date || null,
      intervention_start: boatForm.intervention_start || null,
      intervention_end: boatForm.intervention_end || null,
      note: boatForm.note || null,
    };
    if (editingBoat) {
      await supabase.from('boats').update(data).eq('id', editingBoat.id);
    } else {
      await supabase.from('boats').insert(data);
    }
    setShowBoatModal(false);
    setEditingBoat(null);
    loadAll();
    if (onBoatChange) onBoatChange();
  }

  async function archiveBoat(id, val) {
    await supabase.from('boats').update({ archived: val }).eq('id', id);
    loadAll();
    if (onBoatChange) onBoatChange();
  }

  async function deleteBoat(id) {
    if (!confirm('Supprimer définitivement ce bateau ? Cette action est irréversible.')) return;
    await supabase.from('boats').delete().eq('id', id);
    loadAll();
    if (onBoatChange) onBoatChange();
  }

  async function saveEvent() {
    const { boat_id, label, date, color, note } = eventForm;
    if (!label.trim() || !date || !boat_id) return;
    await supabase.from('milestones').insert({ boat_id, label: label.trim(), date, color, note: note || null });
    setShowMilestoneModal(false);
    setMilestoneForm({ boat_id:'', label:'', date:'', color:'#8A6D3B', note:'' });
    loadAll();
  }

  async function saveSettings() {
    await Promise.all([
      supabase.from('settings').upsert({ key: 'presence_color', value: settingsForm.presence_color }),
      supabase.from('settings').upsert({ key: 'intervention_color', value: settingsForm.intervention_color }),
    ]);
    setSettings(settingsForm);
    setShowSettingsModal(false);
  }

  function openBoatModal(boat) {
    setBoatTab('info');
    if (boat) {
      setEditingBoat(boat);
      setBoatForm({
        name: boat.name || '', hull: boat.hull || '',
        arrival_date: boat.arrival_date || '', departure_date: boat.departure_date || '',
        launch_date: boat.launch_date || '', haulout_date: boat.haulout_date || '',
        intervention_start: boat.intervention_start || '', intervention_end: boat.intervention_end || '',
        note: boat.note || '',
      });
    } else {
      setEditingBoat(null);
      setBoatForm({ name:'', hull:'', arrival_date:'', departure_date:'', launch_date:'', haulout_date:'', intervention_start:'', intervention_end:'', note:'' });
    }
    setShowBoatModal(true);
  }

  const { y, m } = currentDate;
  const quarter = Math.floor(m / 3);
  const quarterStartMonth = quarter * 3;
  const quarterMonths = [quarterStartMonth, quarterStartMonth + 1, quarterStartMonth + 2];
  const quarterLabel = `T${quarter + 1} ${y}`;

  // En mode mois : jours du mois. En mode trimestre : colonnes = semaines
  const days = daysInMonth(y, m);

  // Pour le trimestre, on génère toutes les dates des 3 mois complets
  function getQuarterDays() {
    const result = [];
    quarterMonths.forEach(mo => {
      const totalDays = daysInMonth(y, mo);
      for (let i = 1; i <= totalDays; i++) {
        result.push({ date: dateStr(y, mo, i), month: mo, day: i, totalDays });
      }
    });
    return result;
  }
  const quarterDays = viewMode === 'quarter' ? getQuarterDays() : [];

  const today = new Date();
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const visibleBoats = boats
    .filter(b => !b.archived && (!search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.hull && b.hull.toLowerCase().includes(search.toLowerCase()))))
    .sort((a, b) => {
      if (!a.departure_date) return 1;
      if (!b.departure_date) return -1;
      return a.departure_date.localeCompare(b.departure_date);
    });
  const archivedBoats = boats.filter(b => b.archived);

  function boatDateStatus(boat) {
    const allDates = [boat.arrival_date, boat.departure_date, boat.intervention_start, boat.intervention_end];
    const filled = allDates.filter(Boolean).length;
    if (filled === 0) return '#D63B2F';
    if (filled === allDates.length) return '#2e7d32';
    return '#e65100';
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement du planning…</div>;

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D0D8E8] bg-[#F5F7FA] flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A8BA8]" />
          <input className="w-full pl-8 pr-3 py-2 border border-[#D0D8E8] rounded text-[13px] bg-white text-[#1E2D4E] font-sans focus:outline-none focus:border-[#D63B2F]" placeholder="Rechercher un bateau…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* Switcher Mois / Trimestre */}
        <div className="flex rounded overflow-hidden border border-[#D0D8E8]">
          <button
            onClick={() => setViewMode('month')}
            className="px-3 py-2 text-[11px] font-semibold cursor-pointer border-none"
            style={{ background: viewMode === 'month' ? '#1E2D4E' : 'white', color: viewMode === 'month' ? 'white' : '#1E2D4E' }}
          >
            Mois
          </button>
          <button
            onClick={() => setViewMode('quarter')}
            className="px-3 py-2 text-[11px] font-semibold cursor-pointer border-none border-l border-[#D0D8E8]"
            style={{ background: viewMode === 'quarter' ? '#1E2D4E' : 'white', color: viewMode === 'quarter' ? 'white' : '#1E2D4E' }}
          >
            Trimestre
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => viewMode === 'month' ? changeWeek(-1) : changeMonth(-1)} className="border border-[#D0D8E8] rounded px-3 py-2 text-[#1E2D4E] hover:bg-white cursor-pointer bg-white"><ChevronLeft size={14} /></button>
          <span className="text-[13px] font-bold text-[#1E2D4E] min-w-[180px] text-center">
            {viewMode === 'quarter' ? quarterLabel : weekViewLabel}
          </span>
          <button onClick={() => viewMode === 'month' ? changeWeek(1) : changeMonth(1)} className="border border-[#D0D8E8] rounded px-3 py-2 text-[#1E2D4E] hover:bg-white cursor-pointer bg-white"><ChevronRight size={14} /></button>
          {viewMode === 'month' && (
            <button onClick={() => { setWeekOffset(0); setCurrentDate({ y: new Date().getFullYear(), m: new Date().getMonth() }); }} className="text-[11px] font-semibold px-2 py-2 border border-[#D0D8E8] rounded bg-white cursor-pointer text-[#1E2D4E]">
              Auj.
            </button>
          )}
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setShowSettingsModal(true)} className="border border-[#D0D8E8] rounded px-3 py-2 text-[#7A8BA8] hover:text-[#1E2D4E] cursor-pointer bg-white"><Settings size={14} /></button>
          <button onClick={() => { setMilestoneForm(f => ({ ...f, boat_id: visibleBoats[0]?.id || '' })); setShowMilestoneModal(true); }} className="flex items-center gap-1.5 border border-[#1E2D4E] rounded px-3 py-2 text-[12px] font-semibold text-[#1E2D4E] hover:bg-white cursor-pointer bg-white">
            <Plus size={13} /> Événement
          </button>
          <button onClick={() => openBoatModal(null)} className="flex items-center gap-1.5 bg-[#1E2D4E] text-white border-none rounded px-3 py-2 text-[12px] font-semibold cursor-pointer">
            <Plus size={13} /> Bateau
          </button>
        </div>
      </div>

      {/* Gantt */}
      <div className="overflow-x-auto">
        {viewMode === 'month' ? (
        <table className="border-collapse w-full" style={{ minWidth: 0, width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-[#EEF2F8] border-b border-[#D0D8E8]">
              <th className="text-left px-3 py-2 text-[11px] font-bold text-[#1E2D4E] border-r border-[#D0D8E8] sticky left-0 bg-[#EEF2F8] z-10" style={{ width: 140 }}>Bateau</th>
              {weekViewDays.map(({ date, day, month, year, isMonthStart, isWeekStart }, idx) => (
                <th key={date} className="text-center text-[9px] font-bold py-1 px-0 relative"
                  style={{
                    width: `${(100 - 12) / 28}%`,
                    color: date === todayStr ? '#D63B2F' : '#1E2D4E',
                    borderLeft: isMonthStart ? '2px solid #1E2D4E' : isWeekStart ? '1px solid #C0CCE0' : 'none',
                    background: isMonthStart ? '#DCE4F0' : idx % 2 === 0 ? '#F5F7FA' : '#FFFFFF',
                  }}>
                  {isMonthStart && (
                    <div style={{ fontSize: 7, color: '#1E2D4E', fontWeight: 700, textTransform: 'uppercase' }}>
                      {MONTHS[month].substring(0, 3)}
                    </div>
                  )}
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleBoats.length === 0 && (
              <tr><td colSpan={16} className="text-center py-10 text-[#7A8BA8] text-sm italic">
                {search ? `Aucun bateau trouvé pour "${search}"` : 'Aucun bateau en chantier.'}
              </td></tr>
            )}
            {visibleBoats.map(boat => {
              const boatMs = milestones.filter(ms => ms.boat_id === boat.id);
              return (
                <tr key={boat.id} className="border-b border-[#D0D8E8]">
                  <td className="px-3 py-1 border-r border-[#D0D8E8] sticky left-0 bg-[#F5F7FA] z-10" style={{ minWidth: 160 }}>
                    <div className="text-[13px] font-bold" style={{ color: boatDateStatus(boat) }}>{boat.name} {boat.hull && <span>{boat.hull}</span>}</div>
                    {boat.departure_date && <div className="text-[10px] text-[#7A8BA8]">Départ : {new Date(boat.departure_date).toLocaleDateString('fr-FR')}</div>}
                    {boat.note && <div className="text-[10px] text-[#4A5F80] font-semibold">{boat.note}</div>}
                    <div className="flex gap-2 mt-0.5">
                      <button onClick={() => openBoatModal(boat)} className="text-[10px] text-[#7A8BA8] hover:text-[#1E2D4E] cursor-pointer bg-transparent border-none font-semibold">✎ Modifier</button>
                      <button onClick={() => archiveBoat(boat.id, true)} className="text-[10px] text-[#7A8BA8] hover:text-[#D63B2F] cursor-pointer bg-transparent border-none font-semibold">⬇ Archiver</button>
                    </div>
                  </td>
                  {weekViewDays.map(({ date, isMonthStart, isWeekStart }, idx) => {
                    const isToday = date === todayStr;
                    const inP = boat.arrival_date && boat.departure_date && date >= boat.arrival_date && date <= boat.departure_date;
                    const inI = boat.intervention_start && boat.intervention_end && date >= boat.intervention_start && date <= boat.intervention_end;
                    const fp = date === boat.arrival_date;
                    const lp = date === boat.departure_date;
                    const fi = date === boat.intervention_start;
                    const li = date === boat.intervention_end;
                    const dayMs = boatMs.filter(ms => ms.date === date);
                    const isLaunch = boat.launch_date === date;
                    const isHaulout = boat.haulout_date === date;
                    const bgColor = isToday ? 'rgba(214,59,47,0.08)' : isMonthStart ? '#DCE4F0' : idx % 2 === 0 ? '#F5F7FA' : '#FFFFFF';
                    return (
                      <td key={date} className="p-0 relative" style={{
                        height: 52,
                        background: bgColor,
                        borderLeft: isMonthStart ? '2px solid #1E2D4E' : isWeekStart ? '1px solid #C0CCE0' : 'none',
                      }}>
                        {isToday && <div className="absolute inset-y-0 left-1/2 w-px z-10" style={{ background: '#D63B2F' }} />}
                        {inP && <div className="absolute" style={{ top: '20%', height: 12, left: fp ? 2 : 0, right: lp ? 2 : 0, background: settings.presence_color, borderRadius: `${fp?3:0}px ${lp?3:0}px ${lp?3:0}px ${fp?3:0}px`, opacity: 0.9 }} />}
                        {inI && <div className="absolute" style={{ top: '55%', height: 8, left: fi ? 2 : 0, right: li ? 2 : 0, background: settings.intervention_color, borderRadius: `${fi?3:0}px ${li?3:0}px ${li?3:0}px ${fi?3:0}px`, opacity: 0.95 }} />}
                        {isLaunch && <div onClick={() => setShowNoteModal({ label: "Mise à l'eau", date, note: '' })} className="absolute cursor-pointer z-20" style={{ bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#1565C0', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} title="Mise à l'eau" />}
                        {isHaulout && <div onClick={() => setShowNoteModal({ label: "Sortie chantier", date, note: '' })} className="absolute cursor-pointer z-20" style={{ bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#8A6D3B', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} title="Sortie chantier" />}
                        {dayMs.map(ms => (
                          <div key={ms.id} onClick={() => setShowNoteModal({ label: ms.label, date: ms.date, note: ms.note || '' })} className="absolute cursor-pointer z-20" style={{ bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: ms.color, border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} title={ms.label} />
                        ))}
                      </td>
                    );
                  })}
                  <td></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : (
        /* VUE TRIMESTRE */
        <table className="border-collapse w-full" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-[#EEF2F8] border-b border-[#D0D8E8]">
              <th className="text-left px-3 py-2 text-[11px] font-bold text-[#1E2D4E] border-r border-[#D0D8E8] sticky left-0 bg-[#EEF2F8] z-10" style={{ width: 140 }} rowSpan={2}>Bateau</th>
              {quarterMonths.map(mo => (
                <th key={mo} colSpan={daysInMonth(y, mo)} className="text-center text-[11px] font-bold py-1 border-r border-[#D0D8E8]" style={{ color: '#1E2D4E', background: mo % 2 === 0 ? '#EEF2F8' : '#E8EDF5' }}>
                  {MONTHS[mo]} {y}
                </th>
              ))}
            </tr>
            <tr className="bg-[#EEF2F8] border-b border-[#D0D8E8]">
              {quarterDays.map(({ date, day, month, totalDays }, idx) => (
                <th key={date} className="text-center py-1 px-0" style={{ fontSize: 8, fontWeight: 500, color: date === todayStr ? '#D63B2F' : '#7A8BA8', background: idx % 2 === 0 ? '#F5F7FA' : '#FFFFFF', borderRight: day === totalDays ? '1px solid #D0D8E8' : 'none' }}>
                  {day === 1 || day % 5 === 0 ? day : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleBoats.length === 0 && (
              <tr><td colSpan={quarterDays.length + 1} className="text-center py-10 text-[#7A8BA8] text-sm italic">Aucun bateau en chantier.</td></tr>
            )}
            {visibleBoats.map(boat => {
              const boatMs = milestones.filter(ms => ms.boat_id === boat.id);
              return (
                <tr key={boat.id} className="border-b border-[#D0D8E8]">
                  <td className="px-3 py-1 border-r border-[#D0D8E8] sticky left-0 bg-[#F5F7FA] z-10" style={{ minWidth: 160 }}>
                    <div className="text-[12px] font-bold text-[#1E2D4E]">{boat.name} {boat.hull}</div>
                    <div className="flex gap-2 mt-0.5">
                      <button onClick={() => openBoatModal(boat)} className="text-[10px] text-[#7A8BA8] hover:text-[#1E2D4E] cursor-pointer bg-transparent border-none font-semibold">✎</button>
                      <button onClick={() => archiveBoat(boat.id, true)} className="text-[10px] text-[#7A8BA8] hover:text-[#D63B2F] cursor-pointer bg-transparent border-none font-semibold">⬇</button>
                    </div>
                  </td>
                  {quarterDays.map(({ date, day, month, totalDays }, idx) => {
                    const isToday = date === todayStr;
                    const inP = boat.arrival_date && boat.departure_date && date >= boat.arrival_date && date <= boat.departure_date;
                    const inI = boat.intervention_start && boat.intervention_end && date >= boat.intervention_start && date <= boat.intervention_end;
                    const fp = date === boat.arrival_date, lp = date === boat.departure_date;
                    const fi = date === boat.intervention_start, li = date === boat.intervention_end;
                    const hasMs = boatMs.some(ms => ms.date === date);
                    const isLaunch = boat.launch_date === date;
                    const isHaulout = boat.haulout_date === date;
                    const isLastOfMonth = day === totalDays;
                    const bgColor = isToday ? 'rgba(214,59,47,0.08)' : idx % 2 === 0 ? '#F5F7FA' : '#FFFFFF';
                    return (
                      <td key={date} className="p-0 relative" style={{ height: 48, background: bgColor, borderRight: isLastOfMonth ? '1px solid #D0D8E8' : 'none' }}>
                        {isToday && <div className="absolute inset-y-0 left-1/2" style={{ width: 1, background: '#D63B2F', zIndex: 10 }} />}
                        {inP && <div className="absolute" style={{ top: '18%', height: 10, left: fp ? 1 : 0, right: lp ? 1 : 0, background: settings.presence_color, borderRadius: `${fp?2:0}px ${lp?2:0}px ${lp?2:0}px ${fp?2:0}px`, opacity: 0.85 }} />}
                        {inI && <div className="absolute" style={{ top: '55%', height: 7, left: fi ? 1 : 0, right: li ? 1 : 0, background: settings.intervention_color, borderRadius: `${fi?2:0}px ${li?2:0}px ${li?2:0}px ${fi?2:0}px`, opacity: 0.95 }} />}
                        {(hasMs || isLaunch || isHaulout) && (
                          <div className="absolute z-20" style={{ bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: isLaunch ? '#1565C0' : isHaulout ? '#8A6D3B' : boatMs.find(ms => ms.date === date)?.color || '#8A6D3B', border: '1.5px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {/* Légende */}
      <div className="flex gap-4 px-4 py-2 border-t border-[#D0D8E8] bg-[#EEF2F8] flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1E2D4E]"><div style={{ width:20, height:9, borderRadius:2, background:settings.presence_color, opacity:0.9 }} /> Présence</div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1E2D4E]"><div style={{ width:20, height:9, borderRadius:2, background:settings.intervention_color }} /> Intervention</div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1E2D4E]"><div style={{ width:14, height:14, borderRadius:'50%', background:'#8A6D3B', border:'3px solid white', boxShadow:'0 0 0 1.5px rgba(0,0,0,0.25)' }} /> Événement</div>
      </div>

      {/* Archivés */}
      {archivedBoats.length > 0 && (
        <div className="px-4 py-3 border-t border-[#D0D8E8] bg-[#F5F7FA]">
          <button onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-2 text-[12px] font-bold text-[#4A5F80] uppercase tracking-wider cursor-pointer bg-transparent border-none mb-2">
            <Archive size={13} /> Bateaux archivés ({archivedBoats.length}) {showArchived ? '▼' : '▶'}
          </button>
          {showArchived && (
            <div className="flex flex-wrap gap-2">
              {archivedBoats.map(b => (
                <div key={b.id} className="flex items-center gap-2 bg-[white] border border-[#D0D8E8] rounded-full px-3 py-1 text-[12px] font-semibold text-[#4A5F80]">
                  {b.name} {b.hull}
                  <button onClick={() => archiveBoat(b.id, false)} className="text-[#3D5A4C] cursor-pointer bg-transparent border-none font-bold" title="Désarchiver"><ArchiveRestore size={13} /></button>
                  <button onClick={() => deleteBoat(b.id)} className="text-[#D63B2F] cursor-pointer bg-transparent border-none font-bold" title="Supprimer définitivement">🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal bateau — identique à l'onglet Bateaux */}
      {showBoatModal && (
        <Modal title={editingBoat ? `Modifier — ${editingBoat?.name} ${editingBoat?.hull || ''}` : 'Ajouter un bateau'} onClose={() => { setShowBoatModal(false); setBoatTab('info'); }}>
          {/* Onglets */}
          <div className="flex gap-0 mb-4 border-b border-[#D0D8E8] -mx-5 px-5">
            {['info', 'dates'].map(tab => (
              <button key={tab} onClick={() => setBoatTab(tab)} className="px-4 py-2 text-[12px] font-bold uppercase tracking-wide cursor-pointer bg-transparent border-none"
                style={{ color: boatTab === tab ? '#D63B2F' : '#7A8BA8', borderBottom: boatTab === tab ? '2px solid #D63B2F' : '2px solid transparent' }}>
                {tab === 'info' ? '🚢 Infos' : '📅 Dates'}
              </button>
            ))}
          </div>

          {boatTab === 'info' && (
            <>
              <div className="mb-3"><FieldLabel>Nom du bateau *</FieldLabel><input className={inputClass} value={boatForm.name} onChange={e => setBoatForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex. Lagoon 55" /></div>
              <div className="mb-3"><FieldLabel>N° de coque</FieldLabel><input className={inputClass} value={boatForm.hull} onChange={e => setBoatForm(f => ({ ...f, hull: e.target.value }))} placeholder="Ex. #127" /></div>
              <div className="mb-3"><FieldLabel>Date d&apos;arrivée *</FieldLabel><input type="date" className={inputClass} value={boatForm.arrival_date} onChange={e => setBoatForm(f => ({ ...f, arrival_date: e.target.value }))} /></div>
              <div className="mb-3"><FieldLabel>Date de départ *</FieldLabel><input type="date" className={inputClass} value={boatForm.departure_date} onChange={e => setBoatForm(f => ({ ...f, departure_date: e.target.value }))} /></div>
              <div className="mb-3"><FieldLabel>Note / Ponton</FieldLabel><textarea className={inputClass} style={{ resize:'vertical', minHeight:52 }} value={boatForm.note} onChange={e => setBoatForm(f => ({ ...f, note: e.target.value }))} placeholder="Ex. Ponton B, place 12…" /></div>
              <button onClick={() => setBoatTab('dates')} className="w-full py-2 text-[13px] font-semibold text-[#D63B2F] border border-[#D63B2F] rounded cursor-pointer bg-transparent mb-2">
                Suivant — Dates d&apos;intervention →
              </button>
            </>
          )}

          {boatTab === 'dates' && (
            <>
              <div className="mb-3"><FieldLabel>Mise à l&apos;eau</FieldLabel><input type="date" className={inputClass} value={boatForm.launch_date} onChange={e => setBoatForm(f => ({ ...f, launch_date: e.target.value }))} /></div>
              <div className="mb-3"><FieldLabel>Sortie chantier</FieldLabel><input type="date" className={inputClass} value={boatForm.haulout_date} onChange={e => setBoatForm(f => ({ ...f, haulout_date: e.target.value }))} /></div>
              <div className="mb-3"><FieldLabel>Début intervention (idéal)</FieldLabel><input type="date" className={inputClass} value={boatForm.intervention_start} onChange={e => setBoatForm(f => ({ ...f, intervention_start: e.target.value }))} /></div>
              <div className="mb-4"><FieldLabel>Fin intervention (idéale)</FieldLabel><input type="date" className={inputClass} value={boatForm.intervention_end} onChange={e => setBoatForm(f => ({ ...f, intervention_end: e.target.value }))} /></div>
              <PrimaryButton onClick={saveBoat} className="w-full">Enregistrer</PrimaryButton>
            </>
          )}
        </Modal>
      )}

      {/* Modal événement */}
      {showEventModal && (
        <Modal title="Ajouter un événement" onClose={() => setShowMilestoneModal(false)}>
          <div className="mb-3"><FieldLabel>Bateau</FieldLabel>
            <select className={inputClass} value={eventForm.boat_id} onChange={e => setMilestoneForm(f => ({ ...f, boat_id: e.target.value }))}>
              {boats.filter(b => !b.archived).map(b => <option key={b.id} value={b.id}>{b.name} {b.hull}</option>)}
            </select>
          </div>
          <div className="mb-3"><FieldLabel>Libellé</FieldLabel><input className={inputClass} value={eventForm.label} onChange={e => setMilestoneForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex. Matage, Livraison…" /></div>
          <div className="mb-3"><FieldLabel>Date</FieldLabel><input type="date" className={inputClass} value={eventForm.date} onChange={e => setMilestoneForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="mb-3">
            <FieldLabel>Couleur</FieldLabel>
            <div className="flex gap-3 items-center">
              <input type="color" value={eventForm.color} onChange={e => setMilestoneForm(f => ({ ...f, color: e.target.value }))} style={{ width:44, height:36, padding:2, border:'1px solid #D0D8E8', borderRadius:4, cursor:'pointer' }} />
              <span className="text-[12px] text-[#4A5F80] font-semibold">Couleur du repère</span>
            </div>
          </div>
          <div className="mb-4"><FieldLabel>Note (optionnel)</FieldLabel><textarea className={inputClass} style={{ resize:'vertical', minHeight:52 }} value={eventForm.note} onChange={e => setMilestoneForm(f => ({ ...f, note: e.target.value }))} placeholder="Ex. Grutage à 9h…" /></div>
          <PrimaryButton onClick={saveEvent} className="w-full">Ajouter</PrimaryButton>
        </Modal>
      )}

      {/* Modal paramètres */}
      {showSettingsModal && (
        <Modal title="Couleurs du planning" onClose={() => setShowSettingsModal(false)}>
          <div className="mb-4">
            <FieldLabel>Couleur — Présence du bateau</FieldLabel>
            <div className="flex gap-3 items-center mt-1">
              <input type="color" value={settingsForm.presence_color} onChange={e => setSettingsForm(f => ({ ...f, presence_color: e.target.value }))} style={{ width:44, height:36, padding:2, border:'1px solid #D0D8E8', borderRadius:4, cursor:'pointer' }} />
              <div style={{ flex:1, height:20, borderRadius:3, background:settingsForm.presence_color, opacity:0.9 }} />
            </div>
          </div>
          <div className="mb-6">
            <FieldLabel>Couleur — Période d&apos;intervention</FieldLabel>
            <div className="flex gap-3 items-center mt-1">
              <input type="color" value={settingsForm.intervention_color} onChange={e => setSettingsForm(f => ({ ...f, intervention_color: e.target.value }))} style={{ width:44, height:36, padding:2, border:'1px solid #D0D8E8', borderRadius:4, cursor:'pointer' }} />
              <div style={{ flex:1, height:20, borderRadius:3, background:settingsForm.intervention_color }} />
            </div>
          </div>
          <PrimaryButton onClick={saveSettings} className="w-full">Enregistrer</PrimaryButton>
        </Modal>
      )}

      {/* Modal note */}
      {showNoteModal && (
        <Modal title={showNoteModal.label} onClose={() => setShowNoteModal(null)}>
          <p className="text-[12px] font-semibold text-[#4A5F80] mb-2">{showNoteModal.date}</p>
          {showNoteModal.note ? <p className="text-[13px] text-[#1E2D4E] font-semibold leading-relaxed">{showNoteModal.note}</p> : <p className="text-[13px] text-[#7A8BA8] italic">Aucune note.</p>}
          <div className="mt-4"><PrimaryButton onClick={() => setShowNoteModal(null)} className="w-full">Fermer</PrimaryButton></div>
        </Modal>
      )}
    </div>
  );
}

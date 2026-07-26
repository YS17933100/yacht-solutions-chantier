"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Anchor, User, ChevronDown, ChevronRight, Clock, Loader2, Building2, Flag, Edit2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SPECIALTIES, CATEGORIES, STATUS_LABELS, specialtyMeta, categoryMeta } from "@/lib/constants";
import Modal from "@/components/Modal";
import { FieldLabel, inputClass, PrimaryButton } from "@/components/FormFields";
import GanttView from "@/components/GanttView";
import PlanningView from "@/components/PlanningView";
import ImportExcel from "@/components/ImportExcel";
import HomePage from "@/components/HomePage";
import TechnicianView from "@/components/TechnicianView";
import QualityView from "@/components/QualityView";

const PROVIDER_SPECIALTIES = ["Électricité","Plomberie","Menuiserie","Accastillage","Voilerie","Mécanique","Carrosserie / Peinture","Autre"];

export default function ChantierApp() {
  const [technicians, setTechnicians] = useState([]);
  const [boats, setBoats] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [providers, setProviders] = useState([]);
  const [qualityChecks, setQualityChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [expandedBoats, setExpandedBoats] = useState({});
  const [activeTab, setActiveTab] = useState("accueil");
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(true);

  const [showTechModal, setShowTechModal] = useState(false);
  const [showBoatModal, setShowBoatModal] = useState(false);
  const [editingBoat, setEditingBoat] = useState(null);
  const [boatTab, setBoatTab] = useState('info');
  const [showTaskModal, setShowTaskModal] = useState(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);

  const [techForm, setTechForm] = useState({ name: "", specialty: "elec_plomb" });
  const [boatForm, setBoatForm] = useState({ name: "", hull: "", arrival_date: "", departure_date: "", launch_date: "", haulout_date: "", intervention_start: "", intervention_end: "" });
  const [taskForm, setTaskForm] = useState({ name: "", provider: "Yacht Solutions", category: "electricite", hours: "", is_priority: false, priority_before: "launch" });
  const [editTaskForm, setEditTaskForm] = useState({ hours: "", status: "a_faire", assigned_technician_id: "" });
  const [providerForm, setProviderForm] = useState({ name: "", specialty: "Électricité", phone: "", email: "" });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const [techRes, boatRes, taskRes, provRes, qualRes] = await Promise.all([
      supabase.from("technicians").select("*").order("created_at", { ascending: true }),
      supabase.from("boats").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase.from("providers").select("*").order("created_at", { ascending: true }),
      supabase.from("quality_checks").select("*"),
    ]);
    if (techRes.error || boatRes.error || taskRes.error) {
      setErrorMsg("Impossible de charger les données.");
      setLoading(false);
      return;
    }
    setTechnicians(techRes.data || []);
    setBoats(boatRes.data || []);
    setTasks(taskRes.data || []);
    setProviders(provRes.data || []);
    setQualityChecks(qualRes.data || []);
    setExpandedBoats((prev) => {
      const next = { ...prev };
      (boatRes.data || []).forEach((b, i) => { if (next[b.id] === undefined) next[b.id] = i === 0; });
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function toggleBoat(id) { setExpandedBoats((e) => ({ ...e, [id]: !e[id] })); }

  function login(user) {
    setCurrentUser(user);
    setShowLoginModal(false);
  }

  async function addTechnician() {
    if (!techForm.name.trim()) return;
    await supabase.from("technicians").insert({ name: techForm.name.trim(), specialty: techForm.specialty });
    setTechForm({ name: "", specialty: "elec_plomb" });
    setShowTechModal(false);
    loadAll();
  }

  async function removeTechnician(id) {
    await supabase.from("technicians").delete().eq("id", id);
    loadAll();
  }

  function openBoatModal(boat) {
    setBoatTab('info');
    if (boat) {
      setEditingBoat(boat);
      setBoatForm({
        name: boat.name || "", hull: boat.hull || "",
        arrival_date: boat.arrival_date || "", departure_date: boat.departure_date || "",
        launch_date: boat.launch_date || "", haulout_date: boat.haulout_date || "",
        intervention_start: boat.intervention_start || "", intervention_end: boat.intervention_end || "",
      });
    } else {
      setEditingBoat(null);
      setBoatForm({ name: "", hull: "", arrival_date: "", departure_date: "", launch_date: "", haulout_date: "", intervention_start: "", intervention_end: "" });
    }
    setShowBoatModal(true);
  }

  async function addBoat() {
    if (!boatForm.name.trim()) return;
    const data = {
      name: boatForm.name.trim(), hull: boatForm.hull.trim() || null,
      arrival_date: boatForm.arrival_date || null, departure_date: boatForm.departure_date || null,
      launch_date: boatForm.launch_date || null, haulout_date: boatForm.haulout_date || null,
      intervention_start: boatForm.intervention_start || null, intervention_end: boatForm.intervention_end || null,
    };
    if (editingBoat) { await supabase.from("boats").update(data).eq("id", editingBoat.id); }
    else { await supabase.from("boats").insert(data); }
    setBoatForm({ name: "", hull: "", arrival_date: "", departure_date: "", launch_date: "", haulout_date: "", intervention_start: "", intervention_end: "" });
    setEditingBoat(null);
    setShowBoatModal(false);
    loadAll();
  }

  async function removeBoat(id) {
    await supabase.from("boats").delete().eq("id", id);
    loadAll();
  }

  async function addTask(boatId) {
    if (!taskForm.name.trim() || taskForm.hours === "") return;
    await supabase.from("tasks").insert({
      boat_id: boatId, name: taskForm.name.trim(),
      provider: taskForm.provider.trim() || "Yacht Solutions",
      category: taskForm.category, hours: parseFloat(taskForm.hours) || 0,
      status: "a_faire", is_priority: taskForm.is_priority,
      priority_before: taskForm.is_priority ? taskForm.priority_before : null,
    });
    setTaskForm({ name: "", provider: "Yacht Solutions", category: "electricite", hours: "", is_priority: false, priority_before: "launch" });
    setShowTaskModal(null);
    loadAll();
  }

  async function removeTask(taskId) {
    await supabase.from("tasks").delete().eq("id", taskId);
    loadAll();
  }

  function openEditTask(task) {
    setEditingTask(task);
    setEditTaskForm({
      hours: String(task.hours || ''),
      status: task.status || 'a_faire',
      assigned_technician_id: task.assigned_technician_id || '',
    });
    setShowEditTaskModal(true);
  }

  async function saveEditTask() {
    if (!editingTask) return;
    await supabase.from("tasks").update({
      hours: parseFloat(editTaskForm.hours) || editingTask.hours,
      status: editTaskForm.status,
      assigned_technician_id: editTaskForm.assigned_technician_id || null,
    }).eq("id", editingTask.id);
    setShowEditTaskModal(false);
    setEditingTask(null);
    loadAll();
  }

  async function assignTask(taskId, techId, plannedDate) {
    await supabase.from("tasks").update({
      assigned_technician_id: techId || null,
      planned_date: plannedDate || null,
    }).eq("id", taskId);
    loadAll();
  }

  async function addProvider() {
    if (!providerForm.name.trim()) return;
    await supabase.from("providers").insert({ name: providerForm.name.trim(), specialty: providerForm.specialty, phone: providerForm.phone.trim() || null, email: providerForm.email.trim() || null });
    setProviderForm({ name: "", specialty: "Électricité", phone: "", email: "" });
    setShowProviderModal(false);
    loadAll();
  }

  async function removeProvider(id) {
    await supabase.from("providers").delete().eq("id", id);
    loadAll();
  }

  function tasksForBoat(boatId) { return tasks.filter((t) => t.boat_id === boatId); }

  // Indicateur couleur bateau selon complétude des dates
  function boatDateStatus(boat) {
    const allDates = [boat.arrival_date, boat.departure_date, boat.intervention_start, boat.intervention_end];
    const filled = allDates.filter(Boolean).length;
    if (filled === 0) return 'red';
    if (filled === allDates.length) return 'green';
    return 'orange';
  }

  const isAdmin = currentUser === 'jonathan';
  const currentTech = currentUser === 'jonathan' ? null : technicians.find(t => t.name.toLowerCase() === currentUser?.toLowerCase());

  const TABS = currentTech ? [
    { id: "accueil", label: "Accueil" },
    { id: "mon_planning", label: "Mon Planning" },
    { id: "gantt", label: "Planning bateaux" },
    ...(currentTech.quality_access ? [{ id: "qualite", label: "Qualité" }] : []),
  ] : [
    { id: "accueil", label: "Accueil" },
    { id: "planning_tech", label: "Planning techniciens" },
    { id: "gantt", label: "Planning bateaux" },
    { id: "organisation", label: "Organisation" },
    { id: "techniciens", label: "Techniciens" },
    { id: "prestataires", label: "Prestataires" },
    { id: "kpi", label: "KPI" },
    { id: "qualite", label: "Qualité" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="flex items-center gap-2 text-muted">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">Chargement…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="px-4" style={{ background: "#1E2D4E" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between py-[16px]">
          <div className="flex items-center gap-2.5">
            <Anchor size={20} color="#FFFFFF" strokeWidth={1.8} />
            <div>
              <div className="text-white font-bold text-[15px] tracking-wide">YACHT SOLUTIONS</div>
              <div className="text-white/50 text-[11px] tracking-widest uppercase">Carnet de chantier</div>
            </div>
          </div>
          <div className="flex gap-[12px] text-[11px] font-semibold overflow-x-auto items-center">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="bg-transparent border-none cursor-pointer py-1.5 px-0.5 uppercase tracking-wider whitespace-nowrap"
                style={{ color: activeTab === tab.id ? "#FFFFFF" : "rgba(255,255,255,0.5)", borderBottom: activeTab === tab.id ? "2px solid #D63B2F" : "2px solid transparent" }}>
                {tab.label}
              </button>
            ))}
            {currentUser && (
              <button onClick={() => setShowLoginModal(true)} className="ml-2 text-white/40 hover:text-white/80 bg-transparent border-none cursor-pointer text-[11px]">
                👤 {currentUser}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(30,45,78,0.7)' }}>
          <div className="bg-white rounded-xl p-8 w-full max-w-sm" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div className="text-center mb-6">
              <Anchor size={32} color="#1E2D4E" className="mx-auto mb-3" />
              <div className="text-[18px] font-bold text-inktext">Qui êtes-vous ?</div>
              <div className="text-[12px] text-muted mt-1">Sélectionnez votre nom pour accéder à l'application</div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { const pwd = prompt('Mot de passe admin :'); if (pwd === 'YS2026') login('jonathan'); }} className="w-full py-3 rounded-lg text-[13px] font-bold text-white border-none cursor-pointer" style={{ background: '#D63B2F' }}>
                Jonathan (Admin)
              </button>
              <div className="text-[11px] text-muted text-center my-1">ou</div>
              {technicians.map(t => (
                <button key={t.id} onClick={() => login(t.name)} className="w-full py-2.5 rounded-lg text-[13px] font-semibold border border-border cursor-pointer bg-white text-inktext hover:bg-cream">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Accueil */}
      {activeTab === "accueil" && <HomePage currentUser={currentUser} />}

      {/* Mon Planning (technicien) */}
      {activeTab === "mon_planning" && currentTech && (
        <TechnicianView techId={currentTech.id} techName={currentTech.name} />
      )}

      {/* Planning techniciens (admin) */}
      {activeTab === "planning_tech" && (
        <div className="max-w-5xl mx-auto py-6 px-4">
          <div className="bg-paper border border-border rounded overflow-hidden">
            <PlanningView onDataChange={loadAll} />
          </div>
        </div>
      )}

      {/* KPI */}
      {activeTab === "kpi" && (
        <div className="max-w-5xl mx-auto py-6 px-4">
          <div className="bg-paper border border-border rounded overflow-hidden">
            <PlanningView onDataChange={loadAll} defaultTab="kpi" />
          </div>
        </div>
      )}

      {/* Gantt / Planning bateaux */}
      {activeTab === "gantt" && (
        <div className="max-w-5xl mx-auto py-6 px-4">
          <div className="bg-paper border border-border rounded overflow-hidden">
            <GanttView onBoatChange={loadAll} readonly={!!currentTech} />
          </div>
        </div>
      )}

      {/* Qualité */}
      {activeTab === "qualite" && (
        <div className="max-w-5xl mx-auto py-4 px-4">
          <QualityView currentUser={currentUser} techId={currentTech?.id || null} />
        </div>
      )}

      {activeTab !== "accueil" && activeTab !== "planning_tech" && activeTab !== "gantt" && activeTab !== "kpi" && activeTab !== "mon_planning" && activeTab !== "qualite" && (
        <div className="max-w-3xl mx-auto px-6 py-7 pb-16">
          {errorMsg && <div className="mb-5 rounded border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">{errorMsg}</div>}

          {/* ORGANISATION */}
          {activeTab === "organisation" && (
            <>
              <div className="flex justify-between items-baseline mb-[18px]">
                <h2 className="text-[19px] font-bold m-0">Organisation du chantier</h2>
                <div className="flex gap-2">
                  <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 text-inktext border border-border rounded px-3 py-2 text-[12px] font-semibold cursor-pointer bg-paper hover:bg-cream">
                    ↑ Importer Excel
                  </button>
                  <button onClick={() => openBoatModal(null)} className="flex items-center gap-1.5 text-white border-none rounded px-3 py-2 text-[12px] font-semibold cursor-pointer" style={{ background: '#1E2D4E' }}>
                    <Plus size={13} /> Ajouter un bateau
                  </button>
                </div>
              </div>
              {boats.filter(b => !b.archived).length === 0 && <div className="text-center py-12 text-muted text-sm italic">Aucun bateau pour l'instant.</div>}
              <div className="flex flex-col gap-3.5">
                {boats.filter(b => !b.archived)
                  .sort((a, b) => {
                    if (!a.departure_date) return 1;
                    if (!b.departure_date) return -1;
                    return a.departure_date.localeCompare(b.departure_date);
                  })
                  .map((boat) => {
                  const boatTasks = tasksForBoat(boat.id);
                  const totalHours = boatTasks.reduce((s, t) => s + (t.provider === "Yacht Solutions" ? Number(t.hours) : 0), 0);
                  const status = boatDateStatus(boat);
                  const statusColor = status === 'green' ? '#2e7d32' : status === 'orange' ? '#e65100' : '#D63B2F';
                  return (
                    <div key={boat.id} className="bg-paper border border-border rounded overflow-hidden">
                      <div className="flex items-center justify-between px-[18px] py-3.5 cursor-pointer" onClick={() => toggleBoat(boat.id)}>
                        <div className="flex items-center gap-2.5">
                          {expandedBoats[boat.id] ? <ChevronDown size={16} color="#7A8BA8" /> : <ChevronRight size={16} color="#7A8BA8" />}
                          <div>
                            <div className="font-bold text-[15px]" style={{ color: statusColor }}>
                              {boat.name} {boat.hull && <span>{boat.hull}</span>}
                            </div>
                            {boat.departure_date && (
                              <div className="text-[11px] text-muted">Départ : {new Date(boat.departure_date).toLocaleDateString('fr-FR')}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] text-muted flex items-center gap-1.5"><Clock size={13} /> {totalHours} h</span>
                          <button onClick={(e) => { e.stopPropagation(); openBoatModal(boat); }} className="bg-transparent border-none cursor-pointer text-mutedtext text-[11px] font-semibold px-2 py-1 rounded border border-border">✎ Dates</button>
                          <button onClick={(e) => { e.stopPropagation(); removeBoat(boat.id); }} className="bg-transparent border-none cursor-pointer text-terracottadark p-1"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      {expandedBoats[boat.id] && (
                        <div className="border-t border-border">
                          {boatTasks.length === 0 && <div className="px-[18px] py-4 text-[13px] text-muted italic">Aucun article.</div>}
                          {boatTasks.map((task) => {
                            const cat = categoryMeta(task.category);
                            const st = STATUS_LABELS[task.status];
                            const isOver = task.real_hours && Number(task.real_hours) > Number(task.hours);
                            const assignedTech = technicians.find(t => t.id === task.assigned_technician_id);
                            const assignedProv = providers.find(p => p.id === task.assigned_technician_id);
                            const qualCheck = qualityChecks.find(q => q.task_id === task.id);
                            const qualOk = qualCheck?.is_ok;
                            return (
                              <div key={task.id} className="border-b border-borderlight">
                                <div className="flex items-center justify-between px-[18px] py-[9px]">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                    <div className="min-w-0">
                                      <div className="text-[12px] font-semibold flex items-center gap-1.5 flex-wrap">
                                        {task.article_number && <span className="text-[10px] text-muted font-normal border border-border rounded px-1">{task.article_number}</span>}
                                        {task.name}
                                        {task.is_priority && <Flag size={11} className="text-orange-500 flex-shrink-0" />}
                                        {qualCheck && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${qualOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {qualOk ? '✓ Qualité OK' : '✗ Qualité KO'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-muted">{task.provider} · {cat.label}
                                        {qualCheck && <span className="ml-1">· Contrôlé par {qualCheck.technician_name}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[11px] text-mutedtext">{task.hours}h</span>
                                    {task.real_hours && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isOver ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        →{task.real_hours}h {isOver ? '▲' : '✓'}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold px-2 py-[2px] rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                    <button onClick={() => openEditTask(task)} className="bg-transparent border-none cursor-pointer text-muted p-0.5 hover:text-inktext"><Edit2 size={12} /></button>
                                    <button onClick={() => removeTask(task.id)} className="bg-transparent border-none cursor-pointer text-terracottadark p-0.5"><Trash2 size={12} /></button>
                                  </div>
                                </div>
                                {/* Assignation */}
                                <div className="flex items-center gap-2 px-[18px] pb-[9px] flex-wrap">
                                  <select
                                    className="text-[11px] border border-border rounded px-2 py-1 bg-white text-inktext cursor-pointer"
                                    value={task.assigned_technician_id || ''}
                                    onChange={e => assignTask(task.id, e.target.value, task.planned_date)}
                                  >
                                    <option value="">— Assigner à —</option>
                                    <optgroup label="Équipe interne">
                                      {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </optgroup>
                                    {providers.length > 0 && (
                                      <optgroup label="Prestataires">
                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </optgroup>
                                    )}
                                  </select>
                                  <input
                                    type="date"
                                    className="text-[11px] border border-border rounded px-2 py-1 bg-white text-inktext cursor-pointer"
                                    value={task.planned_date || ''}
                                    onChange={e => assignTask(task.id, task.assigned_technician_id, e.target.value)}
                                  />
                                  {(assignedTech || assignedProv) && (
                                    <span className="text-[10px] font-semibold text-green-700">✓ {assignedTech?.name || assignedProv?.name}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div className="px-[18px] py-2.5">
                            <button onClick={() => setShowTaskModal(boat.id)} className="flex items-center gap-1.5 bg-transparent border border-dashed border-[#B8C8D8] rounded px-3 py-1.5 text-[11.5px] font-semibold text-mutedtext cursor-pointer">
                              <Plus size={12} /> Ajouter un article
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* TECHNICIENS */}
          {activeTab === "techniciens" && (
            <>
              <div className="flex justify-between items-baseline mb-[18px]">
                <h2 className="text-[19px] font-bold m-0">Équipe technique</h2>
                <button onClick={() => setShowTechModal(true)} className="flex items-center gap-1.5 text-white border-none rounded px-3.5 py-2 text-[12.5px] font-semibold cursor-pointer" style={{ background: '#1E2D4E' }}>
                  <Plus size={14} /> Ajouter un technicien
                </button>
              </div>
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-[12px] text-blue-800">
                🔒 <strong>Visible uniquement par vous</strong> — La capacité cible est votre estimation interne. Les techniciens voient toujours 100% de leur planning.
              </div>
              <div className="flex flex-col gap-3">
                {technicians.map((tech) => {
                  const meta = specialtyMeta(tech.specialty);
                  const capacity = tech.capacity_target || 100;
                  const effectiveHours = ((capacity / 100) * 6).toFixed(1);
                  return (
                    <div key={tech.id} className="bg-paper border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex gap-2.5">
                          <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: meta.color + "22" }}>
                            <User size={16} color={meta.color} />
                          </div>
                          <div>
                            <div className="font-bold text-[14.5px]">{tech.name}</div>
                            <div className="text-[11.5px] font-semibold mt-0.5" style={{ color: meta.color }}>{meta.label}</div>
                          </div>
                        </div>
                        <button onClick={() => removeTechnician(tech.id)} className="bg-transparent border-none cursor-pointer text-terracottadark p-0.5"><Trash2 size={14} /></button>
                      </div>
                      {/* Capacité cible */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-muted font-semibold uppercase tracking-wide">Capacité cible (admin)</span>
                          <span className="text-[13px] font-bold" style={{ color: capacity < 100 ? '#e65100' : '#1E2D4E' }}>
                            {capacity}% — {effectiveHours}h/jour effectif
                          </span>
                        </div>
                        <input
                          type="range"
                          min="50" max="100" step="5"
                          value={capacity}
                          onChange={async (e) => {
                            const val = parseInt(e.target.value);
                            await supabase.from('technicians').update({ capacity_target: val }).eq('id', tech.id);
                            loadAll();
                          }}
                          className="w-full cursor-pointer"
                          style={{ accentColor: '#1E2D4E' }}
                        />
                        <div className="flex justify-between text-[10px] text-muted mt-0.5">
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                        {capacity < 100 && (
                          <div className="text-[11px] text-orange-600 mt-1">
                            ℹ️ {tech.name} est planifié(e) sur une base de {effectiveHours}h/jour au lieu de 6h
                          </div>
                        )}
                        {/* Accès qualité */}
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          <div>
                            <div className="text-[11px] font-semibold text-inktext">Accès Qualité</div>
                            <div className="text-[10px] text-muted">Autorise {tech.name} à faire les contrôles qualité</div>
                          </div>
                          <button
                            onClick={async () => {
                              await supabase.from('technicians').update({ quality_access: !tech.quality_access }).eq('id', tech.id);
                              loadAll();
                            }}
                            className="relative inline-flex h-6 w-11 cursor-pointer rounded-full border-none transition-colors"
                            style={{ background: tech.quality_access ? '#1E2D4E' : '#D0D8E8' }}
                          >
                            <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5"
                              style={{ transform: tech.quality_access ? 'translateX(22px)' : 'translateX(2px)' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* PRESTATAIRES */}
          {activeTab === "prestataires" && (
            <>
              <div className="flex justify-between items-baseline mb-[18px]">
                <h2 className="text-[19px] font-bold m-0">Prestataires externes</h2>
                <button onClick={() => setShowProviderModal(true)} className="flex items-center gap-1.5 text-white border-none rounded px-3.5 py-2 text-[12.5px] font-semibold cursor-pointer" style={{ background: '#1E2D4E' }}>
                  <Plus size={14} /> Ajouter un prestataire
                </button>
              </div>
              {providers.length === 0 && <div className="text-center py-12 text-muted text-sm italic">Aucun prestataire pour l'instant.</div>}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {providers.map((prov) => (
                  <div key={prov.id} className="bg-paper border border-border rounded p-4 flex items-start justify-between">
                    <div className="flex gap-2.5">
                      <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2B4C8C22" }}>
                        <Building2 size={16} color="#2B4C8C" />
                      </div>
                      <div>
                        <div className="font-bold text-[14.5px]">{prov.name}</div>
                        <div className="text-[11.5px] font-semibold mt-0.5" style={{ color: '#2B4C8C' }}>{prov.specialty}</div>
                        {prov.phone && <div className="text-[11.5px] text-muted mt-1">📞 {prov.phone}</div>}
                        {prov.email && <div className="text-[11.5px] text-muted">✉️ {prov.email}</div>}
                      </div>
                    </div>
                    <button onClick={() => removeProvider(prov.id)} className="bg-transparent border-none cursor-pointer text-terracottadark p-0.5"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* MODALS */}
      {showImportModal && (
        <Modal title="Importer un fichier Excel" onClose={() => setShowImportModal(false)}>
          <ImportExcel onImportDone={() => { setShowImportModal(false); loadAll(); }} />
        </Modal>
      )}

      {showTechModal && (
        <Modal title="Ajouter un technicien" onClose={() => setShowTechModal(false)}>
          <div className="mb-3.5"><FieldLabel>Nom</FieldLabel><input className={inputClass} value={techForm.name} onChange={(e) => setTechForm({ ...techForm, name: e.target.value })} placeholder="Ex. Sébastien" /></div>
          <div className="mb-[18px]"><FieldLabel>Spécialité</FieldLabel><select className={inputClass} value={techForm.specialty} onChange={(e) => setTechForm({ ...techForm, specialty: e.target.value })}>{SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <PrimaryButton onClick={addTechnician} className="w-full">Ajouter</PrimaryButton>
        </Modal>
      )}

      {showBoatModal && (
        <Modal title={editingBoat ? `Modifier — ${editingBoat.name} ${editingBoat.hull || ''}` : 'Ajouter un bateau'} onClose={() => { setShowBoatModal(false); setEditingBoat(null); setBoatTab('info'); }}>
          <div className="flex gap-0 mb-4 border-b border-border -mx-5 px-5">
            {['info', 'dates'].map(tab => (
              <button key={tab} onClick={() => setBoatTab(tab)} className="px-4 py-2 text-[12px] font-bold uppercase tracking-wide cursor-pointer bg-transparent border-none"
                style={{ color: boatTab === tab ? '#D63B2F' : '#7A8BA8', borderBottom: boatTab === tab ? '2px solid #D63B2F' : '2px solid transparent' }}>
                {tab === 'info' ? '🚢 Infos' : '📅 Dates'}
              </button>
            ))}
          </div>
          {boatTab === 'info' && (
            <>
              <div className="mb-3"><FieldLabel>Nom du bateau</FieldLabel><input className={inputClass} value={boatForm.name} onChange={(e) => setBoatForm({ ...boatForm, name: e.target.value })} placeholder="Ex. Lagoon 55" /></div>
              <div className="mb-3"><FieldLabel>N° de coque</FieldLabel><input className={inputClass} value={boatForm.hull} onChange={(e) => setBoatForm({ ...boatForm, hull: e.target.value })} placeholder="Ex. #127" /></div>
              <div className="mb-3"><FieldLabel>Date d&apos;arrivée</FieldLabel><input type="date" className={inputClass} value={boatForm.arrival_date} onChange={(e) => setBoatForm({ ...boatForm, arrival_date: e.target.value })} /></div>
              <div className="mb-4"><FieldLabel>Date de départ</FieldLabel><input type="date" className={inputClass} value={boatForm.departure_date} onChange={(e) => setBoatForm({ ...boatForm, departure_date: e.target.value })} /></div>
              <button onClick={() => setBoatTab('dates')} className="w-full py-2 text-[13px] font-semibold text-terracotta border border-terracotta rounded cursor-pointer bg-transparent mb-2">
                Suivant — Dates d&apos;intervention →
              </button>
            </>
          )}
          {boatTab === 'dates' && (
            <>
              <div className="mb-3"><FieldLabel>Mise à l&apos;eau</FieldLabel><input type="date" className={inputClass} value={boatForm.launch_date} onChange={(e) => setBoatForm({ ...boatForm, launch_date: e.target.value })} /></div>
              <div className="mb-3"><FieldLabel>Sortie chantier</FieldLabel><input type="date" className={inputClass} value={boatForm.haulout_date} onChange={(e) => setBoatForm({ ...boatForm, haulout_date: e.target.value })} /></div>
              <div className="mb-3"><FieldLabel>Début intervention (idéal)</FieldLabel><input type="date" className={inputClass} value={boatForm.intervention_start} onChange={(e) => setBoatForm({ ...boatForm, intervention_start: e.target.value })} /></div>
              <div className="mb-4"><FieldLabel>Fin intervention (idéale)</FieldLabel><input type="date" className={inputClass} value={boatForm.intervention_end} onChange={(e) => setBoatForm({ ...boatForm, intervention_end: e.target.value })} /></div>
              <PrimaryButton onClick={addBoat} className="w-full">{editingBoat ? 'Enregistrer' : 'Ajouter'}</PrimaryButton>
            </>
          )}
        </Modal>
      )}

      {showTaskModal && (
        <Modal title="Ajouter un article" onClose={() => setShowTaskModal(null)}>
          <div className="mb-3"><FieldLabel>Nom de l&apos;article</FieldLabel><input className={inputClass} value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} placeholder="Ex. Installation Starlink" /></div>
          <div className="mb-3"><FieldLabel>Prestataire</FieldLabel><input className={inputClass} value={taskForm.provider} onChange={(e) => setTaskForm({ ...taskForm, provider: e.target.value })} placeholder="Yacht Solutions" /></div>
          <div className="mb-3"><FieldLabel>Catégorie</FieldLabel><select className={inputClass} value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div className="mb-3"><FieldLabel>Temps d&apos;intervention (heures)</FieldLabel><input type="number" className={inputClass} value={taskForm.hours} onChange={(e) => setTaskForm({ ...taskForm, hours: e.target.value })} placeholder="Ex. 10" /></div>
          <div className="mb-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={taskForm.is_priority} onChange={e => setTaskForm({ ...taskForm, is_priority: e.target.checked })} className="w-4 h-4" />
              <div>
                <div className="text-[13px] font-semibold text-inktext flex items-center gap-1.5"><Flag size={13} className="text-orange-500" /> Priorité</div>
              </div>
            </label>
          </div>
          {taskForm.is_priority && (
            <div className="mb-3 pl-7">
              <FieldLabel>Avant quelle date ?</FieldLabel>
              <select className={inputClass} value={taskForm.priority_before} onChange={e => setTaskForm({ ...taskForm, priority_before: e.target.value })}>
                <option value="launch">Mise à l&apos;eau</option>
                <option value="haulout">Sortie chantier</option>
                <option value="intervention_end">Fin d&apos;intervention</option>
              </select>
            </div>
          )}
          <div className="mt-4"><PrimaryButton onClick={() => addTask(showTaskModal)} className="w-full">Ajouter l&apos;article</PrimaryButton></div>
        </Modal>
      )}

      {showEditTaskModal && editingTask && (
        <Modal title={`Modifier — ${editingTask.name}`} onClose={() => setShowEditTaskModal(false)}>
          <div className="mb-3"><FieldLabel>Heures d&apos;intervention</FieldLabel><input type="number" className={inputClass} value={editTaskForm.hours} onChange={e => setEditTaskForm(f => ({ ...f, hours: e.target.value }))} /></div>
          <div className="mb-3"><FieldLabel>Statut</FieldLabel>
            <select className={inputClass} value={editTaskForm.status} onChange={e => setEditTaskForm(f => ({ ...f, status: e.target.value }))}>
              <option value="a_faire">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
            </select>
          </div>
          <div className="mb-4"><FieldLabel>Assigner à</FieldLabel>
            <select className={inputClass} value={editTaskForm.assigned_technician_id} onChange={e => setEditTaskForm(f => ({ ...f, assigned_technician_id: e.target.value }))}>
              <option value="">— Non assigné —</option>
              <optgroup label="Équipe interne">{technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
              {providers.length > 0 && <optgroup label="Prestataires">{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
            </select>
          </div>
          <PrimaryButton onClick={saveEditTask} className="w-full">Enregistrer</PrimaryButton>
        </Modal>
      )}

      {showProviderModal && (
        <Modal title="Ajouter un prestataire" onClose={() => setShowProviderModal(false)}>
          <div className="mb-3"><FieldLabel>Nom de la société</FieldLabel><input className={inputClass} value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} placeholder="Ex. Timonnier" /></div>
          <div className="mb-3"><FieldLabel>Spécialité</FieldLabel><select className={inputClass} value={providerForm.specialty} onChange={(e) => setProviderForm({ ...providerForm, specialty: e.target.value })}>{PROVIDER_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="mb-3"><FieldLabel>Téléphone</FieldLabel><input className={inputClass} value={providerForm.phone} onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })} placeholder="Ex. 06 12 34 56 78" /></div>
          <div className="mb-[18px]"><FieldLabel>Email</FieldLabel><input className={inputClass} value={providerForm.email} onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value })} placeholder="Ex. contact@timonnier.fr" /></div>
          <PrimaryButton onClick={addProvider} className="w-full">Ajouter</PrimaryButton>
        </Modal>
      )}
    </div>
  );
}

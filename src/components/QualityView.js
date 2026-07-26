"use client";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, FileText, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const CRITERIA = [
  { id: 'connexion', label: 'Connexion', desc: 'Câblage électrique, plomberie, raccordements' },
  { id: 'fonctionnement', label: 'Fonctionnement', desc: 'Test de bon fonctionnement de l\'article' },
  { id: 'aspect_visuel', label: 'Aspect visuel', desc: 'Finitions, propreté, aspect esthétique' },
];

export default function QualityView({ currentUser, techId }) {
  const [boats, setBoats] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [step, setStep] = useState('select'); // select | control | summary | issues
  const [pending, setPending] = useState([]); // articles à contrôler
  const [responses, setResponses] = useState({}); // { taskId: { connexion: true/false, fonctionnement: true/false, aspect_visuel: true/false } }
  const [submitting, setSubmitting] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [boatRes, taskRes, checkRes] = await Promise.all([
      supabase.from('boats').select('*').eq('archived', false),
      supabase.from('tasks').select('*').eq('status', 'termine'),
      supabase.from('quality_checks').select('*').order('checked_at', { ascending: false }),
    ]);
    setBoats(boatRes.data || []);
    setTasks(taskRes.data || []);
    setChecks(checkRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function selectBoat(boat) {
    setSelectedBoat(boat);
    // Articles terminés de ce bateau pas encore contrôlés depuis le dernier contrôle
    const boatTasks = tasks.filter(t => t.boat_id === boat.id && t.provider === 'Yacht Solutions');
    const lastCheck = checks.find(c => c.boat_id === boat.id && c.technician_id === techId);
    const lastCheckDate = lastCheck ? lastCheck.checked_at : null;

    const pendingTasks = boatTasks.filter(t => {
      const alreadyChecked = checks.find(c => c.task_id === t.id);
      if (!alreadyChecked) return true;
      // Si article contrôlé mais nouveau contrôle après dernière validation
      if (lastCheckDate && t.validated_at > lastCheckDate) return true;
      return false;
    });

    if (pendingTasks.length === 0) {
      setStep('no_pending');
    } else {
      setPending(pendingTasks);
      const init = {};
      pendingTasks.forEach(t => { init[t.id] = { connexion: null, fonctionnement: null, aspect_visuel: null }; });
      setResponses(init);
      setStep('control');
    }
  }

  function setResponse(taskId, criterion, value) {
    setResponses(prev => ({ ...prev, [taskId]: { ...prev[taskId], [criterion]: value } }));
  }

  function allAnswered() {
    return pending.every(t => {
      const r = responses[t.id];
      return r && r.connexion !== null && r.fonctionnement !== null && r.aspect_visuel !== null;
    });
  }

  async function submitControl() {
    if (!allAnswered()) return;
    setSubmitting(true);
    for (const task of pending) {
      const r = responses[task.id];
      await supabase.from('quality_checks').insert({
        task_id: task.id,
        boat_id: selectedBoat.id,
        technician_id: techId,
        technician_name: currentUser,
        connexion: r.connexion,
        fonctionnement: r.fonctionnement,
        aspect_visuel: r.aspect_visuel,
      });
    }
    await loadAll();
    setSubmitting(false);
    setStep('summary');
  }

  function getFailedItems() {
    return checks.filter(c => c.boat_id === selectedBoat?.id && !c.is_ok);
  }

  async function generatePDF() {
    const issues = checks.filter(c => !c.is_ok);
    const lines = [];
    lines.push('RAPPORT QUALITÉ — YACHT SOLUTIONS');
    lines.push(`Généré le ${new Date().toLocaleDateString('fr-FR')} par ${currentUser}`);
    lines.push('');
    lines.push('ARTICLES À REPRENDRE :');
    lines.push('');

    for (const issue of issues) {
      const task = tasks.find(t => t.id === issue.task_id) || {};
      const boat = boats.find(b => b.id === issue.boat_id) || {};
      const failed = [];
      if (!issue.connexion) failed.push('Connexion');
      if (!issue.fonctionnement) failed.push('Fonctionnement');
      if (!issue.aspect_visuel) failed.push('Aspect visuel');
      lines.push(`• ${boat.name || ''} ${boat.hull || ''} — ${task.name || 'Article inconnu'}`);
      lines.push(`  Critère(s) échoué(s) : ${failed.join(', ')}`);
      lines.push(`  Contrôlé par : ${issue.technician_name} le ${new Date(issue.checked_at).toLocaleDateString('fr-FR')}`);
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-qualite-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted text-sm">Chargement…</div>;

  // Liste globale des problèmes qualité
  const allIssues = checks.filter(c => !c.is_ok);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[18px] font-bold text-inktext">Contrôle qualité</h2>
          <p className="text-[12px] text-muted mt-0.5">Connecté en tant que <strong>{currentUser}</strong></p>
        </div>
        {allIssues.length > 0 && (
          <button
            onClick={() => setShowIssues(!showIssues)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] font-semibold cursor-pointer"
          >
            <AlertTriangle size={14} />
            {allIssues.length} article(s) à reprendre
          </button>
        )}
      </div>

      {/* Liste des problèmes globaux */}
      {showIssues && (
        <div className="mb-6 bg-paper border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ background: '#fff3f3' }}>
            <span className="text-[13px] font-bold text-red-700">Articles à reprendre</span>
            <button onClick={generatePDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold text-white border-none cursor-pointer" style={{ background: '#1E2D4E' }}>
              <FileText size={12} /> Générer PDF
            </button>
          </div>
          <div className="divide-y divide-border">
            {allIssues.map(issue => {
              const task = tasks.find(t => t.id === issue.task_id);
              const boat = boats.find(b => b.id === issue.boat_id);
              const failed = [];
              if (!issue.connexion) failed.push('Connexion');
              if (!issue.fonctionnement) failed.push('Fonctionnement');
              if (!issue.aspect_visuel) failed.push('Aspect visuel');
              return (
                <div key={issue.id} className="px-4 py-3 flex items-start gap-3">
                  <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-inktext">{task?.name || 'Article inconnu'}</div>
                    <div className="text-[11px] text-muted">{boat?.name} {boat?.hull} · Contrôlé par {issue.technician_name}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {failed.map(f => (
                        <span key={f} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{f}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted">{new Date(issue.checked_at).toLocaleDateString('fr-FR')}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sélection du bateau */}
      {step === 'select' && (
        <div className="bg-paper border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[13px] font-bold text-inktext">Choisir un bateau à contrôler</span>
          </div>
          <div className="divide-y divide-border">
            {boats.map(boat => {
              const boatTasks = tasks.filter(t => t.boat_id === boat.id && t.provider === 'Yacht Solutions');
              const boatChecks = checks.filter(c => c.boat_id === boat.id);
              const checkedIds = new Set(boatChecks.map(c => c.task_id));
              const pendingCount = boatTasks.filter(t => !checkedIds.has(t.id)).length;
              const issuesCount = boatChecks.filter(c => !c.is_ok).length;
              return (
                <button key={boat.id} onClick={() => selectBoat(boat)}
                  className="w-full px-4 py-3 flex items-center gap-3 cursor-pointer bg-transparent border-none text-left hover:bg-cream transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-inktext">{boat.name} {boat.hull}</div>
                    <div className="text-[11px] text-muted">{boatTasks.length} articles terminés</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{pendingCount} à contrôler</span>
                    )}
                    {issuesCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{issuesCount} ❌</span>
                    )}
                    {pendingCount === 0 && issuesCount === 0 && boatTasks.length > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ OK</span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-muted" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pas d'articles à contrôler */}
      {step === 'no_pending' && (
        <div className="bg-paper border border-border rounded-xl p-8 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <div className="text-[14px] font-bold text-inktext mb-1">Tout est à jour !</div>
          <div className="text-[12px] text-muted">Aucun nouvel article terminé à contrôler pour {selectedBoat?.name} {selectedBoat?.hull}.</div>
          <button onClick={() => setStep('select')} className="mt-4 px-4 py-2 text-[12px] font-semibold text-white rounded border-none cursor-pointer" style={{ background: '#1E2D4E' }}>
            ← Choisir un autre bateau
          </button>
        </div>
      )}

      {/* Contrôle des articles */}
      {step === 'control' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStep('select')} className="text-[12px] text-muted bg-transparent border-none cursor-pointer hover:text-inktext">← Retour</button>
            <h3 className="text-[14px] font-bold text-inktext">{selectedBoat?.name} {selectedBoat?.hull} — {pending.length} article(s) à contrôler</h3>
          </div>
          <div className="flex flex-col gap-4">
            {pending.map((task, idx) => {
              const r = responses[task.id] || {};
              const allOk = r.connexion === true && r.fonctionnement === true && r.aspect_visuel === true;
              const hasNo = r.connexion === false || r.fonctionnement === false || r.aspect_visuel === false;
              return (
                <div key={task.id} className="bg-paper border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-3" style={{ background: allOk ? '#f0faf4' : hasNo ? '#fff3f3' : undefined }}>
                    <span className="text-[11px] font-bold text-muted w-6">{idx + 1}</span>
                    <span className="text-[13px] font-bold text-inktext flex-1">{task.name}</span>
                    {allOk && <CheckCircle size={16} className="text-green-500" />}
                    {hasNo && <XCircle size={16} className="text-red-500" />}
                  </div>
                  <div className="divide-y divide-border">
                    {CRITERIA.map(crit => (
                      <div key={crit.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-[12px] font-semibold text-inktext">{crit.label}</div>
                          <div className="text-[10px] text-muted">{crit.desc}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setResponse(task.id, crit.id, true)}
                            className="px-3 py-1.5 text-[11px] font-bold rounded cursor-pointer border-none transition-colors"
                            style={{ background: r[crit.id] === true ? '#2e7d32' : '#f0f0f0', color: r[crit.id] === true ? 'white' : '#666' }}
                          >
                            ✓ Oui
                          </button>
                          <button
                            onClick={() => setResponse(task.id, crit.id, false)}
                            className="px-3 py-1.5 text-[11px] font-bold rounded cursor-pointer border-none transition-colors"
                            style={{ background: r[crit.id] === false ? '#D63B2F' : '#f0f0f0', color: r[crit.id] === false ? 'white' : '#666' }}
                          >
                            ✗ Non
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={submitControl}
            disabled={!allAnswered() || submitting}
            className="mt-6 w-full py-3 text-[13px] font-bold text-white rounded-xl border-none cursor-pointer disabled:opacity-50"
            style={{ background: allAnswered() ? '#1E2D4E' : '#ccc' }}
          >
            {submitting ? 'Enregistrement…' : `Valider le contrôle qualité (${pending.length} article${pending.length > 1 ? 's' : ''})`}
          </button>
        </div>
      )}

      {/* Résumé après contrôle */}
      {step === 'summary' && (
        <div>
          <div className="bg-paper border border-border rounded-xl p-6 text-center mb-4">
            <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
            <div className="text-[15px] font-bold text-inktext mb-1">Contrôle qualité validé !</div>
            <div className="text-[12px] text-muted">{pending.length} article(s) contrôlé(s) sur {selectedBoat?.name} {selectedBoat?.hull}</div>
          </div>

          {(() => {
            const newIssues = pending.filter(t => {
              const r = responses[t.id];
              return r && (r.connexion === false || r.fonctionnement === false || r.aspect_visuel === false);
            });
            if (newIssues.length === 0) return (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-[13px] font-semibold text-green-700">
                ✓ Tous les articles passent le contrôle qualité !
              </div>
            );
            return (
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-red-200 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-red-700">{newIssues.length} article(s) à reprendre</span>
                  <button onClick={generatePDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold text-white border-none cursor-pointer" style={{ background: '#1E2D4E' }}>
                    <FileText size={12} /> Générer PDF
                  </button>
                </div>
                <div className="divide-y divide-red-100">
                  {newIssues.map(task => {
                    const r = responses[task.id];
                    const failed = [];
                    if (!r.connexion) failed.push('Connexion');
                    if (!r.fonctionnement) failed.push('Fonctionnement');
                    if (!r.aspect_visuel) failed.push('Aspect visuel');
                    return (
                      <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                        <XCircle size={14} className="text-red-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-[12px] font-semibold text-inktext">{task.name}</div>
                          <div className="flex gap-1 mt-0.5">
                            {failed.map(f => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">{f}</span>)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <button onClick={() => { setStep('select'); setSelectedBoat(null); }} className="mt-4 w-full py-2.5 text-[12px] font-semibold text-inktext rounded-xl border border-border cursor-pointer bg-white">
            ← Contrôler un autre bateau
          </button>
        </div>
      )}
    </div>
  );
}

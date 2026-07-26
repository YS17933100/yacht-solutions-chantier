"use client";
import { useState, useEffect, useCallback } from "react";
import { Anchor, Send, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function HomePage({ currentUser }) {
  const [boats, setBoats] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weekSummary, setWeekSummary] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [boatRes, taskRes, techRes] = await Promise.all([
      supabase.from('boats').select('*').eq('archived', false),
      supabase.from('tasks').select('*'),
      supabase.from('technicians').select('*'),
    ]);
    setBoats(boatRes.data || []);
    setTasks(taskRes.data || []);
    setTechnicians(techRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Génération automatique du résumé de la semaine
  useEffect(() => {
    if (loading || boats.length === 0) return;

    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const mondayStr = monday.toISOString().split('T')[0];
    const fridayStr = friday.toISOString().split('T')[0];

    // Bateaux actifs cette semaine
    const activeBoats = boats.filter(b => {
      if (!b.intervention_start || !b.intervention_end) return false;
      return b.intervention_start <= fridayStr && b.intervention_end >= mondayStr;
    });

    // Calcul avancement par bateau
    const boatProgress = boats.map(b => {
      const ysTasks = tasks.filter(t => t.boat_id === b.id && t.provider === 'Yacht Solutions');
      const done = ysTasks.filter(t => t.status === 'termine').length;
      return {
        ...b,
        progress: ysTasks.length > 0 ? Math.round(done / ysTasks.length * 100) : 0,
        totalTasks: ysTasks.length,
        doneTasks: done,
      };
    }).filter(b => b.totalTasks > 0);

    // Génération du texte
    const dayFr = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const dateStr = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

    let summary = `Bonjour à tous ! 👋\n\n`;
    summary += `Nous sommes le ${dayFr[today.getDay()]} ${dateStr(today)} — voici le point de la semaine.\n\n`;

    if (activeBoats.length === 0) {
      summary += `🚢 Aucun bateau en intervention cette semaine.\n\n`;
    } else if (activeBoats.length === 1) {
      summary += `🚢 Cette semaine nous travaillons sur **${activeBoats[0].name} ${activeBoats[0].hull || ''}**.\n\n`;
    } else {
      const names = activeBoats.map(b => `${b.name} ${b.hull || ''}`.trim());
      const last = names.pop();
      summary += `🚢 Cette semaine nous travaillons principalement sur **${names.join(', ')}** et **${last}**.\n\n`;
    }

    if (boatProgress.length > 0) {
      summary += `📊 Voici les taux d'avancement des bateaux en cours :\n`;
      boatProgress.forEach(b => {
        const emoji = b.progress === 100 ? '✅' : b.progress > 50 ? '🔵' : b.progress > 0 ? '🟡' : '⚪';
        summary += `${emoji} ${b.name} ${b.hull || ''} — ${b.progress}% (${b.doneTasks}/${b.totalTasks} articles)\n`;
      });
    }

    setWeekSummary(summary);
  }, [boats, tasks, loading]);

  async function sendIntel() {
    if (!message.trim() || !currentUser) return;
    setSending(true);
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'intel', from: currentUser, message }),
      });
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  // Bateaux avec avancement
  const boatProgress = boats.map(b => {
    const ysTasks = tasks.filter(t => t.boat_id === b.id && t.provider === 'Yacht Solutions');
    const done = ysTasks.filter(t => t.status === 'termine').length;
    return {
      ...b,
      progress: ysTasks.length > 0 ? Math.round(done / ysTasks.length * 100) : 0,
      totalTasks: ysTasks.length,
      doneTasks: done,
    };
  }).filter(b => b.totalTasks > 0).sort((a, b) => {
    if (!a.departure_date) return 1;
    if (!b.departure_date) return -1;
    return a.departure_date.localeCompare(b.departure_date);
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted text-sm">Chargement…</div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Résumé automatique de la semaine */}
      <div className="bg-paper border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: '#1E2D4E' }}>
          <Anchor size={18} color="white" />
          <div>
            <div className="text-white font-bold text-[14px]">Planning de la semaine</div>
            <div className="text-white/60 text-[11px]">Généré automatiquement</div>
          </div>
        </div>
        <div className="p-5">
          <div className="text-[13px] text-inktext leading-relaxed whitespace-pre-line">
            {weekSummary || 'Chargement du résumé…'}
          </div>
        </div>
      </div>

      {/* Avancement bateaux */}
      <div className="bg-paper border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp size={15} color="#1E2D4E" />
          <span className="text-[13px] font-bold text-inktext">Avancement des bateaux</span>
        </div>
        <div className="divide-y divide-border">
          {boatProgress.length === 0 && (
            <div className="px-5 py-8 text-center text-muted text-sm italic">Aucun bateau avec des articles pour l'instant.</div>
          )}
          {boatProgress.map(b => (
            <div key={b.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-inktext">{b.name} {b.hull}</div>
                <div className="text-[11px] text-muted">{b.doneTasks}/{b.totalTasks} articles validés</div>
              </div>
              <div className="flex items-center gap-3" style={{ minWidth: 160 }}>
                <div className="flex-1 bg-cream rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full transition-all" style={{
                    width: `${b.progress}%`,
                    background: b.progress === 100 ? '#2e7d32' : b.progress > 50 ? '#1E2D4E' : '#D63B2F'
                  }} />
                </div>
                <span className="text-[12px] font-bold min-w-[36px] text-right" style={{
                  color: b.progress === 100 ? '#2e7d32' : b.progress > 50 ? '#1E2D4E' : '#D63B2F'
                }}>{b.progress}%</span>
              </div>
              <div>
                {b.progress === 100
                  ? <CheckCircle size={16} color="#2e7d32" />
                  : b.progress > 0
                  ? <Clock size={16} color="#1E2D4E" />
                  : <AlertCircle size={16} color="#D63B2F" />
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Intel */}
      <div className="bg-paper border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[13px] font-bold text-inktext">💬 Message Intel</div>
          <div className="text-[11px] text-muted mt-0.5">Partage tes intentions ou remarques pour la semaine — Jonathan recevra un email automatiquement</div>
        </div>
        <div className="p-5">
          {!currentUser && (
            <div className="text-[12px] text-muted italic mb-3">Connecte-toi pour envoyer un message.</div>
          )}
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] text-inktext bg-cream resize-none focus:outline-none focus:border-inktext"
            rows={4}
            placeholder={`Ex. Cette semaine je vais commencer par la menuiserie du L82 #107, je pense finir jeudi. J'aurai besoin de l'aide de Théodore vendredi pour le câblage...`}
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={!currentUser}
          />
          <div className="flex justify-end mt-3">
            {sent ? (
              <div className="flex items-center gap-2 text-[12px] font-semibold text-green-700">
                <CheckCircle size={14} /> Message envoyé à Jonathan !
              </div>
            ) : (
              <button
                onClick={sendIntel}
                disabled={!message.trim() || !currentUser || sending}
                className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                style={{ background: '#1E2D4E' }}
              >
                <Send size={13} />
                {sending ? 'Envoi…' : 'Envoyer à Jonathan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

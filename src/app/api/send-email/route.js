import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { type, from, message, kpiData } = await request.json();
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      // Mode dev sans clé API — on simule
      console.log('Email simulé:', { type, from, message });
      return NextResponse.json({ success: true, simulated: true });
    }

    let subject, html;

    if (type === 'intel') {
      subject = `Intel — ${from}`;
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1E2D4E;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0">⚓ Yacht Solutions — Message Intel</h2>
          </div>
          <div style="padding:20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
            <p><strong>De :</strong> ${from}</p>
            <p><strong>Message :</strong></p>
            <div style="background:#f5f7fa;padding:15px;border-radius:6px;border-left:4px solid #D63B2F">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
        </div>`;
    } else if (type === 'monthly_kpi') {
      const { month, year, technicians, boats, totalHours, realHours } = kpiData;
      subject = `Rapport KPI — ${month} ${year} — Yacht Solutions`;
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1E2D4E;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0">📊 Rapport KPI mensuel — ${month} ${year}</h2>
          </div>
          <div style="padding:20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
            <p style="color:#666">Bonjour Jonathan, voici le récapitulatif de production du mois de ${month} ${year}.</p>
            
            <h3 style="color:#1E2D4E;border-bottom:2px solid #D63B2F;padding-bottom:8px">📋 Résumé général</h3>
            <table style="width:100%;border-collapse:collapse">
              <tr style="background:#f5f7fa">
                <td style="padding:10px;font-weight:bold">Heures planifiées</td>
                <td style="padding:10px;text-align:right">${totalHours}h</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold">Heures réelles effectuées</td>
                <td style="padding:10px;text-align:right">${realHours}h</td>
              </tr>
              <tr style="background:#f5f7fa">
                <td style="padding:10px;font-weight:bold">Efficacité</td>
                <td style="padding:10px;text-align:right;color:${realHours > totalHours ? '#D63B2F' : '#2e7d32'}">${totalHours > 0 ? Math.round(realHours/totalHours*100) : 0}%</td>
              </tr>
            </table>
            <p style="color:#666;font-size:12px;margin-top:4px">💡 <em>L'efficacité compare les heures réellement passées aux heures prévues. En dessous de 100% = vous êtes plus rapides que prévu. Au dessus = des dépassements ont eu lieu.</em></p>

            <h3 style="color:#1E2D4E;border-bottom:2px solid #D63B2F;padding-bottom:8px;margin-top:24px">👥 Taux d'occupation par technicien</h3>
            <p style="color:#666;font-size:12px">Le taux d'occupation représente le pourcentage de jours ouvrés où le technicien avait des tâches planifiées.</p>
            <table style="width:100%;border-collapse:collapse">
              ${(technicians || []).map((t, i) => `
              <tr style="background:${i%2===0?'#f5f7fa':'white'}">
                <td style="padding:10px;font-weight:bold">${t.name}</td>
                <td style="padding:10px">${t.specialty}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;color:${t.rate > 80?'#1E2D4E':t.rate > 50?'#2B4C8C':'#D63B2F'}">${t.rate}%</td>
              </tr>`).join('')}
            </table>

            <h3 style="color:#1E2D4E;border-bottom:2px solid #D63B2F;padding-bottom:8px;margin-top:24px">🚢 Avancement par bateau</h3>
            <p style="color:#666;font-size:12px">Pourcentage d'articles validés sur le total des articles Yacht Solutions pour chaque bateau.</p>
            <table style="width:100%;border-collapse:collapse">
              ${(boats || []).map((b, i) => `
              <tr style="background:${i%2===0?'#f5f7fa':'white'}">
                <td style="padding:10px;font-weight:bold">${b.name} ${b.hull}</td>
                <td style="padding:10px">
                  <div style="background:#e0e0e0;border-radius:10px;height:8px;overflow:hidden">
                    <div style="background:${b.progress===100?'#2e7d32':b.progress>50?'#1E2D4E':'#D63B2F'};height:8px;width:${b.progress}%;border-radius:10px"></div>
                  </div>
                </td>
                <td style="padding:10px;text-align:right;font-weight:bold;color:${b.progress===100?'#2e7d32':'#1E2D4E'}">${b.progress}%</td>
              </tr>`).join('')}
            </table>

            <div style="margin-top:24px;padding:15px;background:#f5f7fa;border-radius:6px;font-size:12px;color:#666">
              <p>📧 Ce rapport est envoyé automatiquement en fin de mois par l'application Yacht Solutions Chantier.</p>
            </div>
          </div>
        </div>`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'chantier@yachtsolutions.fr',
        to: ['jonathan.meot@yachtsolutions.fr'],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

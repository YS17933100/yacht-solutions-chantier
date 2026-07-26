import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Mapping statut Excel → statut app
function mapStatus(status) {
  if (!status) return 'a_faire';
  const s = status.toLowerCase().trim();
  if (s === 'fait') return 'termine';
  if (s === 'a finir' || s === 'en cours') return 'en_cours';
  if (s === 'annulé') return 'a_faire';
  return 'a_faire';
}

// Détection catégorie par mots-clés dans le nom
function detectCategory(name) {
  if (!name) return 'autre';
  const n = name.toLowerCase();
  if (n.match(/électr|câbl|prise|usb|vhf|gps|starlink|tv|led|éclairag|chargeur|batterie|onduleur|panneau solaire|ais|radar|pilote|auto|réseau|wifi|routeur|nmea|multiplexeur/)) return 'electricite';
  if (n.match(/plomb|eau|robinet|pompe|durit|tuyau|filtre|osmoseur|dessalinisateur|réservoir|tank|wc|hublot étanche|vanne|sea cock|passe-coque/)) return 'plomberie';
  if (n.match(/bois|menuiser|table|étagère|plancher|coffre|rangement|porte|cloison|canapé|coussin|tissu|cuir|housse|matelassure|carré|cabine/)) return 'menuiserie';
  if (n.match(/winch|poulie|écoute|drisse|safran|barre|mouillage|ancre|chaîne|guindeau|tangon|bout|filet|filière|accastillag|gréement|voile|furler/)) return 'accastillage';
  return 'autre';
}

// Parse le nom du bateau : "L82#107" → { name: "Lagoon 82", hull: "#107" }
function parseBoatName(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  // Format LXX#YYY
  const match = str.match(/^([A-Za-z]+)(\d+)#(\d+)$/);
  if (match) {
    const prefix = match[1].toUpperCase();
    const model = match[2];
    const hull = `#${match[3]}`;
    const brandMap = { L: 'Lagoon', B: 'Bali', C: 'Catana', F: 'Fountaine Pajot', J: 'Jeanneau', D: 'Dufour' };
    const brand = brandMap[prefix] || prefix;
    return { name: `${brand} ${model}`, hull };
  }
  // Format libre
  const parts = str.split('#');
  if (parts.length === 2) {
    return { name: parts[0].trim(), hull: `#${parts[1].trim()}` };
  }
  return { name: str, hull: '' };
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse Excel avec SheetJS (via dynamic import)
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Chercher la feuille "Missions Prod"
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('mission') || n.toLowerCase().includes('prod')) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    if (rows.length < 2) {
      return NextResponse.json({ error: 'Feuille vide ou format non reconnu' }, { status: 400 });
    }

    // Trouver les indices des colonnes par entête
    const headers = rows[0].map(h => (h ? String(h).toLowerCase().trim() : ''));
    const col = {
      bateau: headers.findIndex(h => h === '' || h.includes('bateau') || h.includes('l82') || h.includes('l55')) === -1 ? 0 : headers.findIndex(h => h.includes('bateau')),
      societe: Math.max(headers.findIndex(h => h.includes('société') || h.includes('societe')), 1),
      article: Math.max(headers.findIndex(h => h.includes('article')), 2),
      prestation: Math.max(headers.findIndex(h => h.includes('prestation')), 3),
      qui: Math.max(headers.findIndex(h => h === 'qui'), 6),
      duree: Math.max(headers.findIndex(h => h.includes('durée') || h.includes('duree') || h.includes('heure')), 12),
      statut: Math.max(headers.findIndex(h => h === 'statut'), 13),
    };
    // Fallback si pas de colonne 0 header
    col.bateau = 0;

    // Récupérer les techniciens existants
    const { data: techs } = await supabase.from('technicians').select('id, name');
    
    // Normalisation : enlève accents, minuscules, espaces
    function normalize(str) {
      return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();
    }
    
    const techMap = {};
    (techs || []).forEach(t => {
      techMap[normalize(t.name)] = t.id;
      // Aussi indexer par préfixe de 4 caractères pour les variations
      const norm = normalize(t.name);
      if (norm.length >= 4) techMap[norm.substring(0, 4)] = t.id;
    });

    function findTech(name) {
      if (!name) return null;
      const norm = normalize(name);
      // Correspondance exacte
      if (techMap[norm]) return techMap[norm];
      // Correspondance par préfixe 4 chars
      if (norm.length >= 4 && techMap[norm.substring(0, 4)]) return techMap[norm.substring(0, 4)];
      // Correspondance partielle
      const found = Object.entries(techMap).find(([k]) => k.startsWith(norm.substring(0, 4)) || norm.startsWith(k.substring(0, 4)));
      return found ? found[1] : null;
    }

    // Grouper les lignes par bateau
    const boatMap = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const boatRaw = row[col.bateau];
      if (!boatRaw) continue;
      const boatKey = String(boatRaw).trim();
      if (!boatKey || boatKey.length < 2) continue;

      const prestation = row[col.prestation];
      if (!prestation) continue;

      if (!boatMap[boatKey]) boatMap[boatKey] = [];
      boatMap[boatKey].push({
        societe: row[col.societe] || 'Yacht Solutions',
        article_number: row[col.article] ? String(row[col.article]).replace('.0', '') : null,
        name: String(prestation).trim(),
        qui: row[col.qui] ? String(row[col.qui]).trim() : null,
        hours: row[col.duree] ? parseFloat(row[col.duree]) : 0,
        statut: row[col.statut] ? String(row[col.statut]).trim() : 'A faire',
      });
    }

    const results = { created: 0, updated: 0, tasks: 0, errors: [] };

    for (const [boatKey, taskList] of Object.entries(boatMap)) {
      const parsed = parseBoatName(boatKey);
      if (!parsed) continue;

      // Chercher si le bateau existe déjà
      let { data: existingBoat } = await supabase
        .from('boats')
        .select('id')
        .eq('name', parsed.name)
        .eq('hull', parsed.hull)
        .single();

      let boatId;
      if (existingBoat) {
        boatId = existingBoat.id;
        results.updated++;
      } else {
        const { data: newBoat, error } = await supabase
          .from('boats')
          .insert({ name: parsed.name, hull: parsed.hull })
          .select('id')
          .single();
        if (error) { results.errors.push(`Bateau ${boatKey}: ${error.message}`); continue; }
        boatId = newBoat.id;
        results.created++;
      }

      // Insérer les articles
      for (const task of taskList) {
        const category = detectCategory(task.name);
        const status = mapStatus(task.statut);

        // Trouver le technicien par nom
        let techId = null;
        if (task.qui) {
          techId = findTech(task.qui);
        }

        // Vérifier si l'article existe déjà (par nom + bateau)
        const { data: existing } = await supabase
          .from('tasks')
          .select('id')
          .eq('boat_id', boatId)
          .eq('name', task.name)
          .single();

        if (existing) {
          await supabase.from('tasks').update({
            provider: task.societe,
            article_number: task.article_number,
            category,
            hours: task.hours || 0,
            status,
            assigned_technician_id: techId,
          }).eq('id', existing.id);
        } else {
          const { error } = await supabase.from('tasks').insert({
            boat_id: boatId,
            name: task.name,
            provider: task.societe,
            article_number: task.article_number,
            category,
            hours: task.hours || 0,
            status,
            assigned_technician_id: techId,
          });
          if (error) results.errors.push(`Article "${task.name}": ${error.message}`);
          else results.tasks++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import terminé ! ${results.created} bateau(x) créé(s), ${results.updated} mis à jour, ${results.tasks} articles importés.`,
      details: results,
    });

  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Erreur lors de l\'import: ' + err.message }, { status: 500 });
  }
}

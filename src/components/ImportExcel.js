"use client";
import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertTriangle, X, FileSpreadsheet } from "lucide-react";

export default function ImportExcel({ onImportDone }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Fichier non reconnu. Merci d\'importer un fichier Excel (.xlsx ou .xls)');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de l\'import');
      } else {
        setResult(data);
        if (onImportDone) onImportDone();
      }
    } catch (err) {
      setError('Erreur de connexion: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  return (
    <div>
      {/* Zone de dépôt */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragging ? '#1E2D4E' : '#D0D8E8',
          background: dragging ? '#EEF2F8' : '#F5F7FA',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[#1E2D4E] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
            <div className="text-[13px] font-semibold text-inktext">Import en cours…</div>
            <div className="text-[11px] text-muted">Lecture du fichier et création des bateaux et articles</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#EEF2F8' }}>
              <FileSpreadsheet size={24} color="#1E2D4E" />
            </div>
            <div className="text-[14px] font-bold text-inktext">Glisse ton fichier Excel ici</div>
            <div className="text-[12px] text-muted">ou clique pour sélectionner</div>
            <div className="text-[11px] text-muted">Format accepté : .xlsx, .xls · Feuille "Missions Prod"</div>
          </div>
        )}
      </div>

      {/* Résultat succès */}
      {result && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-[13px] font-bold text-green-700">{result.message}</span>
          </div>
          {result.details?.errors?.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-orange-600 mb-1">Avertissements :</div>
              {result.details.errors.map((e, i) => (
                <div key={i} className="text-[11px] text-orange-600">• {e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-red-700">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 bg-transparent border-none cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Info format */}
      <div className="mt-4 bg-paper border border-border rounded-lg p-3">
        <div className="text-[11px] font-bold text-inktext mb-2 uppercase tracking-wide">Format attendu (feuille "Missions Prod")</div>
        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted">
          <div><span className="font-semibold text-inktext">Colonne 1</span> — Nom du bateau (ex. L82#107)</div>
          <div><span className="font-semibold text-inktext">Colonne 2</span> — Société / Prestataire</div>
          <div><span className="font-semibold text-inktext">Colonne 4</span> — Nom de la prestation</div>
          <div><span className="font-semibold text-inktext">Colonne 7</span> — Technicien (Qui)</div>
          <div><span className="font-semibold text-inktext">Colonne 13</span> — Durée estimée (heures)</div>
          <div><span className="font-semibold text-inktext">Colonne 14</span> — Statut</div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import {
  type AnalysisSession,
  sessionsForPatient,
  sessionDelete,
  sessionUpdateLabel,
} from "../../services/sessionStore";

interface Props {
  patientId:  number;
  isOpen:     boolean;
  onClose:    () => void;
  onLoad:     (s: AnalysisSession) => void;
  refreshKey: number;
}

function formatDate(ts: number): string {
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Bugün ${time}`;
  if (diff === 1) return `Dün ${time}`;
  if (diff < 7)   return `${diff} gün önce`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

function scoreColor(s: number) {
  if (s >= 90) return "#4ade80";
  if (s >= 78) return "#facc15";
  return "#f87171";
}

function scoreLabel(s: number) {
  if (s >= 90) return "Mükemmel";
  if (s >= 78) return "İyi";
  if (s >= 65) return "Orta";
  return "Düşük";
}

export const SessionHistoryDrawer: React.FC<Props> = ({
  patientId, isOpen, onClose, onLoad, refreshKey,
}) => {
  const [sessions,   setSessions]   = useState<AnalysisSession[]>([]);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editLabel,  setEditLabel]  = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (patientId > 0 && isOpen) {
      sessionsForPatient(patientId).then(setSessions);
    }
  }, [patientId, refreshKey, isOpen]);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleLabelSave = async (id: string) => {
    if (editLabel.trim()) {
      await sessionUpdateLabel(id, editLabel.trim());
      setSessions(ss => ss.map(s => s.id === id ? { ...s, label: editLabel.trim() } : s));
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await sessionDelete(id);
    setSessions(ss => ss.filter(s => s.id !== id));
    setDeletingId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="mt-4 rounded-2xl border border-gray-700/60 bg-gray-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            📋 Analiz Geçmişi
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {sessions.length === 0 ? "Henüz kayıt yok" : `${sessions.length} kayıtlı seans`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
        >
          ×
        </button>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto p-3 space-y-2.5">
        {sessions.length === 0 && (
          <div className="py-10 text-center">
            <div className="text-4xl mb-3 opacity-30">🗂</div>
            <p className="text-sm text-gray-600">Analiz tamamlandıkça otomatik kaydedilir</p>
          </div>
        )}

        {sessions.map(s => {
          const isDeleting = deletingId === s.id;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-gray-700/50 bg-gray-800/60 overflow-hidden"
              style={{ opacity: isDeleting ? 0.5 : 1 }}
            >
              {/* Card top */}
              <div className="flex items-start gap-3 p-3">
                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700 border border-gray-600/50">
                  {s.thumbnailB64
                    ? <img src={s.thumbnailB64} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl opacity-30">👤</div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === s.id ? (
                    <input
                      ref={inputRef}
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={() => handleLabelSave(s.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter")  handleLabelSave(s.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full text-sm font-medium rounded px-2 py-0.5 outline-none bg-gray-700 border border-indigo-500 text-white"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(s.id); setEditLabel(s.label); }}
                      className="group/label flex items-center gap-1 text-left max-w-full"
                    >
                      <span className="text-sm font-semibold text-gray-200 truncate">{s.label}</span>
                      <span className="text-[10px] text-gray-600 opacity-0 group-hover/label:opacity-100 transition-opacity">✎</span>
                    </button>
                  )}
                  <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(s.createdAt)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold" style={{ color: scoreColor(s.symmetryScore) }}>
                      {s.symmetryScore.toFixed(1)}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${scoreColor(s.symmetryScore)}18`,
                        color:      scoreColor(s.symmetryScore),
                        border:     `1px solid ${scoreColor(s.symmetryScore)}40`,
                      }}
                    >
                      {scoreLabel(s.symmetryScore)}
                    </span>
                    {s.plan && (
                      <span className="ml-auto text-[10px] rounded px-1.5 py-0.5 bg-violet-900/30 border border-violet-700/40 text-violet-400">
                        AI Rapor ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metric strip */}
              <div className="grid grid-cols-3 text-center border-t border-gray-700/40">
                {[
                  { label: "Kaş Δ",   val: s.eyebrowDeltaMm },
                  { label: "Dudak Δ", val: s.lipDeltaMm },
                  { label: "Eksen Δ", val: s.midlineDeviationMm },
                ].map((m, mi) => (
                  <div key={m.label} className={`py-1.5 ${mi < 2 ? "border-r border-gray-700/40" : ""}`}>
                    <p className="text-[10px] text-gray-600">{m.label}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${Math.abs(m.val) > 3 ? "text-orange-400" : "text-gray-400"}`}>
                      {m.val > 0 ? "+" : ""}{m.val.toFixed(2)}
                      <span className="text-[9px] text-gray-600 ml-0.5">mm</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-700/40 bg-gray-900/30">
                {isDeleting ? (
                  <>
                    <span className="flex-1 text-xs text-red-400">Emin misiniz?</span>
                    <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/60 text-red-300 hover:bg-red-900">
                      Evet, Sil
                    </button>
                    <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 bg-gray-700/50">
                      İptal
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { onLoad(s); onClose(); }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      ↩ Yükle
                    </button>
                    <button
                      onClick={() => setDeletingId(s.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-gray-700/50 text-gray-500 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                      title="Sil"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sessions.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-700/40">
          <p className="text-center text-[11px] text-gray-600">💾 Seanslar bu cihazda yerel olarak saklanır</p>
        </div>
      )}
    </div>
  );
};

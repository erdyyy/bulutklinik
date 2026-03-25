/**
 * Ekip & Rol Yönetimi
 * ───────────────────
 * Doktor, klinik ekibini (asistan, resepsiyonist, hemşire) yönetir.
 * Her rolün izinleri kısıtlı — enterprise satış için kritik özellik.
 *
 * Şu an: localStorage persistent demo (main backend bağımsız).
 * Prod: /api/clinic/team endpoint'lerine bağlanır.
 */
import { useState, useEffect } from "react";
import DoctorLayout from "../../components/doctor/DoctorLayout";
import {
  Users, Plus, Trash2, Shield, Eye, Edit3,
  CheckCircle2, XCircle, Crown, UserCheck, Clipboard, Phone,
  ChevronDown, ChevronUp, Mail, Save,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Role = "doctor" | "assistant" | "receptionist" | "nurse";

interface Permission {
  key:   string;
  label: string;
  desc:  string;
  icon:  React.ReactNode;
}

interface TeamMember {
  id:          string;
  name:        string;
  email:       string;
  phone:       string;
  role:        Role;
  permissions: string[];
  addedAt:     string;
  active:      boolean;
}

// ── Rol tanımları ──────────────────────────────────────────────────────────────

const ROLE_META: Record<Role, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  doctor:       { label: "Doktor",         color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",   icon: <Crown size={13}/> },
  assistant:    { label: "Asistan",         color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200", icon: <UserCheck size={13}/> },
  receptionist: { label: "Resepsiyonist",  color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",   icon: <Phone size={13}/> },
  nurse:        { label: "Hemşire",        color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",   icon: <Clipboard size={13}/> },
};

const ALL_PERMISSIONS: Permission[] = [
  { key: "view_patients",    label: "Hasta Listesi",      desc: "Tüm hastaları görüntüle",            icon: <Eye size={13}/> },
  { key: "edit_patients",    label: "Hasta Düzenle",      desc: "Hasta bilgisi güncelleme",           icon: <Edit3 size={13}/> },
  { key: "view_calendar",    label: "Takvim Görüntüle",  desc: "Randevu takvimini gör",              icon: <Eye size={13}/> },
  { key: "manage_calendar",  label: "Takvim Yönet",      desc: "Randevu oluştur/iptal et",           icon: <Edit3 size={13}/> },
  { key: "view_invoices",    label: "Fatura Görüntüle",  desc: "Fatura ve ödeme bilgisi",            icon: <Eye size={13}/> },
  { key: "manage_invoices",  label: "Fatura Yönet",      desc: "Fatura oluştur ve tahsilat al",      icon: <Edit3 size={13}/> },
  { key: "run_ai_analysis",  label: "AI Analiz",          desc: "Yüz asimetri analizi başlat",        icon: <Shield size={13}/> },
  { key: "view_ai_reports",  label: "AI Raporları Gör",  desc: "Analiz raporlarını görüntüle",       icon: <Eye size={13}/> },
  { key: "manage_stock",     label: "Stok Yönet",        desc: "Ürün stok takibi",                   icon: <Edit3 size={13}/> },
  { key: "view_reports",     label: "ROI Raporları",     desc: "Klinik gelir ve istatistikler",      icon: <Eye size={13}/> },
];

const DEFAULT_PERMISSIONS: Record<Role, string[]> = {
  doctor:       ALL_PERMISSIONS.map(p => p.key),
  assistant:    ["view_patients", "edit_patients", "view_calendar", "manage_calendar", "view_ai_reports", "run_ai_analysis"],
  receptionist: ["view_patients", "view_calendar", "manage_calendar", "view_invoices", "manage_invoices"],
  nurse:        ["view_patients", "view_calendar", "view_ai_reports", "manage_stock"],
};

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "medicaai_team_v1";

function loadTeam(): TeamMember[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveTeam(members: TeamMember[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${m.color} ${m.bg} ${m.border}`}>
      {m.icon} {m.label}
    </span>
  );
}

// ── Ana sayfa ──────────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>(loadTeam);
  const [showAdd, setShowAdd]           = useState(false);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [saved, setSaved]               = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "assistant" as Role,
  });
  const [formPerms, setFormPerms] = useState<string[]>(DEFAULT_PERMISSIONS.assistant);

  useEffect(() => { saveTeam(members) }, [members]);

  const handleRoleChange = (role: Role) => {
    setForm(f => ({ ...f, role }));
    setFormPerms(DEFAULT_PERMISSIONS[role]);
  };

  const toggleFormPerm = (key: string) =>
    setFormPerms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    const member: TeamMember = {
      id: crypto.randomUUID(), ...form,
      permissions: formPerms,
      addedAt: new Date().toLocaleDateString("tr-TR"),
      active: true,
    };
    setMembers(prev => [member, ...prev]);
    setForm({ name: "", email: "", phone: "", role: "assistant" });
    setFormPerms(DEFAULT_PERMISSIONS.assistant);
    setShowAdd(false);
  };

  const toggleActive = (id: string) =>
    setMembers(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));

  const removeMember = (id: string) =>
    setMembers(prev => prev.filter(m => m.id !== id));

  const updatePerms = (id: string, perms: string[]) =>
    setMembers(prev => prev.map(m => m.id === id ? { ...m, permissions: perms } : m));

  const savePerms = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const doctorCount       = members.filter(m => m.role === "doctor" && m.active).length;
  const assistantCount    = members.filter(m => m.role === "assistant" && m.active).length;
  const receptionistCount = members.filter(m => m.role === "receptionist" && m.active).length;
  const nurseCount        = members.filter(m => m.role === "nurse" && m.active).length;

  return (
    <DoctorLayout title="Ekip & Rol Yönetimi">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Başlık ──────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Users size={22}/>
              </div>
              <div>
                <h2 className="font-bold text-lg">Klinik Ekibi</h2>
                <p className="text-violet-200 text-sm">Rol bazlı yetki yönetimi</p>
              </div>
            </div>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={16}/> Üye Ekle
            </button>
          </div>

          {/* Özet istatistikler */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: "Doktor",        count: doctorCount,       color: "bg-teal-500/30" },
              { label: "Asistan",       count: assistantCount,    color: "bg-violet-500/30" },
              { label: "Resepsiyonist", count: receptionistCount, color: "bg-blue-500/30" },
              { label: "Hemşire",       count: nurseCount,        color: "bg-rose-500/30" },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl px-3 py-2 text-center`}>
                <p className="text-xl font-bold">{s.count}</p>
                <p className="text-xs text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Üye Ekleme Formu ─────────────────────────────────────── */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Plus size={16} className="text-violet-600"/> Yeni Ekip Üyesi
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Ad Soyad *</label>
                <input
                  type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ayşe Kaya"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">E-posta *</label>
                <input
                  type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ayse@klinik.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Telefon</label>
                <input
                  type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0532 000 00 00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Rol *</label>
                <select
                  value={form.role} onChange={e => handleRoleChange(e.target.value as Role)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                >
                  <option value="assistant">Asistan</option>
                  <option value="receptionist">Resepsiyonist</option>
                  <option value="nurse">Hemşire</option>
                  <option value="doctor">Doktor</option>
                </select>
              </div>
            </div>

            {/* İzinler */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">İzinler</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox" checked={formPerms.includes(p.key)}
                      onChange={() => toggleFormPerm(p.key)}
                      className="accent-violet-600 w-4 h-4 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-700 group-hover:text-violet-700">{p.label}</p>
                      <p className="text-[10px] text-gray-400">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleAdd}
                disabled={!form.name || !form.email}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-40"
              >
                <Plus size={14}/> Ekle
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* ── Üye Listesi ──────────────────────────────────────────── */}
        {members.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-violet-300"/>
            </div>
            <p className="font-semibold text-gray-500">Henüz ekip üyesi yok</p>
            <p className="text-sm text-gray-400 mt-1">Asistan, resepsiyonist veya hemşire ekleyin</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors mx-auto"
            >
              <Plus size={14}/> İlk Üyeyi Ekle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(member => {
              const isExpanded = expandedId === member.id;
              return (
                <div
                  key={member.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    member.active ? "border-gray-100" : "border-gray-100 opacity-60"
                  }`}
                >
                  {/* Üye satırı */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{member.name}</p>
                        <RoleBadge role={member.role}/>
                        {!member.active && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pasif</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10}/> {member.email}</p>
                        {member.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10}/> {member.phone}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-400">
                        {member.permissions.length}/{ALL_PERMISSIONS.length} izin
                      </span>

                      {/* Aktif toggle */}
                      <button
                        onClick={() => toggleActive(member.id)}
                        title={member.active ? "Pasife Al" : "Aktife Al"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          member.active
                            ? "text-emerald-500 hover:bg-emerald-50"
                            : "text-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {member.active ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                      </button>

                      {/* Genişlet */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : member.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        title="İzinleri düzenle"
                      >
                        {isExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                      </button>

                      {/* Sil */}
                      <button
                        onClick={() => removeMember(member.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Üyeyi kaldır"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  {/* Genişletilmiş izin paneli */}
                  {isExpanded && (
                    <div className="border-t border-gray-50 px-5 py-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">İzinleri Düzenle</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_PERMISSIONS.map(p => {
                          const hasIt = member.permissions.includes(p.key);
                          return (
                            <label key={p.key} className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-gray-50">
                              <input
                                type="checkbox" checked={hasIt}
                                onChange={() => {
                                  const next = hasIt
                                    ? member.permissions.filter(k => k !== p.key)
                                    : [...member.permissions, p.key];
                                  updatePerms(member.id, next);
                                }}
                                className="accent-violet-600 w-4 h-4 flex-shrink-0"
                              />
                              <div>
                                <p className={`text-xs font-medium ${hasIt ? "text-gray-700" : "text-gray-400"} group-hover:text-violet-700`}>{p.label}</p>
                                <p className="text-[10px] text-gray-400">{p.desc}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
                        <button
                          onClick={() => { updatePerms(member.id, ALL_PERMISSIONS.map(p => p.key)); }}
                          className="text-xs text-violet-600 hover:underline"
                        >
                          Tümünü Seç
                        </button>
                        <button
                          onClick={() => updatePerms(member.id, [])}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Tümünü Kaldır
                        </button>
                        <button
                          onClick={() => { updatePerms(member.id, DEFAULT_PERMISSIONS[member.role]); }}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Rol Varsayılanı
                        </button>
                        <button
                          onClick={savePerms}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
                        >
                          {saved ? <CheckCircle2 size={12}/> : <Save size={12}/>}
                          {saved ? "Kaydedildi" : "Kaydet"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Rol İzin Matrisi (referans) ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-800">📋 Rol Varsayılan İzin Matrisi</p>
            <p className="text-xs text-gray-400 mt-0.5">Referans — her üye bireysel olarak özelleştirilebilir</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-2.5 text-gray-400 font-semibold">İzin</th>
                  {(["doctor","assistant","receptionist","nurse"] as Role[]).map(r => (
                    <th key={r} className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_META[r].color} ${ROLE_META[r].bg}`}>
                        {ROLE_META[r].label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map((p, i) => (
                  <tr key={p.key} className={i % 2 === 0 ? "bg-gray-50/50" : ""}>
                    <td className="px-5 py-2 text-gray-600">{p.label}</td>
                    {(["doctor","assistant","receptionist","nurse"] as Role[]).map(r => (
                      <td key={r} className="px-3 py-2 text-center">
                        {DEFAULT_PERMISSIONS[r].includes(p.key)
                          ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto"/>
                          : <XCircle     size={13} className="text-gray-200 mx-auto"/>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DoctorLayout>
  );
}

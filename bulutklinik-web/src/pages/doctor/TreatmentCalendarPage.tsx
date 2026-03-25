/**
 * Tedavi Takip Takvimi
 * ─────────────────────
 * Hastaya bağlı tedavi seanslarını aylık takvim + liste görünümünde gösterir.
 * Veri: localStorage  (restart-safe, no backend required)
 */

import { useState, useEffect, useMemo } from 'react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar,
  Clock, User, FileText, Bell, CheckCircle2, XCircle, Circle,
  Syringe, Zap, Droplets, Sparkles, Tag, type LucideIcon,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type TxType = 'botox' | 'filler' | 'laser' | 'prp' | 'mesotherapy' | 'other'
type TxStatus = 'planned' | 'completed' | 'cancelled'

interface TreatmentEntry {
  id:            string
  patientId:     number
  patientName:   string
  treatmentType: TxType
  date:          string       // YYYY-MM-DD
  nextFollowUp:  string | null
  sessionNumber: number
  notes:         string
  area:          string
  dosage:        string
  status:        TxStatus
  createdAt:     number
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TX_TYPES: Record<TxType, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  botox:      { label: 'Botoks',      color: 'text-purple-700', bg: 'bg-purple-100',  Icon: Syringe },
  filler:     { label: 'Dolgu',       color: 'text-rose-700',   bg: 'bg-rose-100',    Icon: Droplets },
  laser:      { label: 'Lazer',       color: 'text-amber-700',  bg: 'bg-amber-100',   Icon: Zap },
  prp:        { label: 'PRP',         color: 'text-red-700',    bg: 'bg-red-100',     Icon: Droplets },
  mesotherapy:{ label: 'Mezoterapi',  color: 'text-teal-700',   bg: 'bg-teal-100',    Icon: Sparkles },
  other:      { label: 'Diğer',       color: 'text-gray-700',   bg: 'bg-gray-100',    Icon: Tag },
}

const STATUS_META: Record<TxStatus, { label: string; Icon: LucideIcon; cls: string }> = {
  planned:   { label: 'Planlandı',  Icon: Circle,        cls: 'text-blue-600' },
  completed: { label: 'Tamamlandı', Icon: CheckCircle2,  cls: 'text-green-600' },
  cancelled: { label: 'İptal',      Icon: XCircle,       cls: 'text-red-500' },
}

const STORAGE_KEY = 'bk_treatment_entries'
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadEntries(): TreatmentEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveEntries(entries: TreatmentEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function fmt(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
// Monday-based weekday (0=Mon…6=Sun)
function weekday(year: number, month: number, day: number) {
  const d = new Date(year, month, day).getDay()
  return d === 0 ? 6 : d - 1
}

// ─── Blank form ───────────────────────────────────────────────────────────────

const BLANK = (): Omit<TreatmentEntry, 'id' | 'createdAt'> => ({
  patientId:     0,
  patientName:   '',
  treatmentType: 'botox',
  date:          todayStr(),
  nextFollowUp:  null,
  sessionNumber: 1,
  notes:         '',
  area:          '',
  dosage:        '',
  status:        'planned',
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function TreatmentCalendarPage() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<string>(todayStr())
  const [entries, setEntries] = useState<TreatmentEntry[]>(loadEntries)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK())
  const [filterType, setFilterType] = useState<TxType | 'all'>('all')

  useEffect(() => { saveEntries(entries) }, [entries])

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const total = daysInMonth(year, month)
    const offset = weekday(year, month, 1)  // blank cells before day 1
    const cells: (number | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= total; d++) cells.push(d)
    return cells
  }, [year, month])

  // Entries indexed by date
  const byDate = useMemo(() => {
    const map: Record<string, TreatmentEntry[]> = {}
    entries.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [entries])

  // Selected day entries
  const dayEntries = useMemo(() =>
    (byDate[selected] ?? []).sort((a, b) => a.createdAt - b.createdAt),
  [byDate, selected])

  // Upcoming follow-ups (next 30 days)
  const upcoming = useMemo(() => {
    const now = todayStr()
    const limit = new Date(); limit.setDate(limit.getDate() + 30)
    const limitStr = limit.toISOString().slice(0, 10)
    return entries
      .filter(e => e.nextFollowUp && e.nextFollowUp >= now && e.nextFollowUp <= limitStr)
      .sort((a, b) => a.nextFollowUp!.localeCompare(b.nextFollowUp!))
      .slice(0, 8)
  }, [entries])

  // Filter for list panel
  const filtered = useMemo(() =>
    filterType === 'all' ? dayEntries : dayEntries.filter(e => e.treatmentType === filterType),
  [dayEntries, filterType])

  // ── Mutations ──────────────────────────────────────────────────────────────
  function addEntry() {
    if (!form.patientName.trim() || !form.date) return
    const entry: TreatmentEntry = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }
    setEntries(prev => [...prev, entry])
    setSelected(form.date)
    setShowForm(false)
    setForm(BLANK())
  }

  function updateStatus(id: string, status: TxStatus) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // ── Nav ────────────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DoctorLayout title="Tedavi Takip Takvimi" action={
      <button
        onClick={() => { setShowForm(true); setForm({ ...BLANK(), date: selected }) }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
      >
        <Plus size={15} /> Seans Ekle
      </button>
    }>

      <div className="flex gap-4 h-full">

        {/* ── Left: Calendar + Upcoming ─────────────────────────────────── */}
        <div className="flex flex-col gap-4 w-80 flex-shrink-0">

          {/* Month header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600">
              <button onClick={prevMonth} className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-white text-sm">
                {MONTHS_TR[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS_TR.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-2">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 p-2 gap-0.5">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`e${idx}`} />
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateStr === todayStr()
                const isSel  = dateStr === selected
                const evts   = byDate[dateStr] ?? []

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelected(dateStr)}
                    className={`relative flex flex-col items-center justify-start pt-1 pb-1.5 rounded-xl text-xs font-medium transition-all h-10 ${
                      isSel  ? 'bg-teal-600 text-white shadow-md' :
                      isToday? 'bg-teal-50 text-teal-700 ring-2 ring-teal-400' :
                               'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{day}</span>
                    {evts.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full px-0.5">
                        {evts.slice(0, 3).map((e, i) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isSel ? 'bg-white/70' :
                              e.treatmentType === 'botox'       ? 'bg-purple-500' :
                              e.treatmentType === 'filler'      ? 'bg-rose-500' :
                              e.treatmentType === 'laser'       ? 'bg-amber-500' :
                              e.treatmentType === 'prp'         ? 'bg-red-500' :
                              e.treatmentType === 'mesotherapy' ? 'bg-teal-500' :
                                                                  'bg-gray-400'
                            }`}
                          />
                        ))}
                        {evts.length > 3 && (
                          <span className={`text-[8px] ${isSel ? 'text-white/70' : 'text-gray-400'}`}>+{evts.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Upcoming follow-ups */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Bell size={15} className="text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">Yaklaşan Kontroller</span>
              {upcoming.length > 0 && (
                <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {upcoming.length}
                </span>
              )}
            </div>
            <div className="overflow-y-auto max-h-64 divide-y divide-gray-50">
              {upcoming.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8">Önümüzdeki 30 günde<br/>kontrol randevusu yok</div>
              ) : upcoming.map(e => {
                const cfg = TX_TYPES[e.treatmentType]
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <cfg.Icon className={cfg.color} size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{e.patientName}</p>
                      <p className="text-[11px] text-gray-400">{cfg.label} · {fmt(e.nextFollowUp!)}</p>
                    </div>
                    <button
                      onClick={() => setSelected(e.nextFollowUp!)}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Git →
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Day detail ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Day header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="text-teal-600" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{fmt(selected)}</p>
              <p className="text-xs text-gray-400">
                {dayEntries.length === 0 ? 'Bu gün için kayıt yok' : `${dayEntries.length} seans kaydı`}
              </p>
            </div>

            {/* Type filter chips */}
            <div className="flex gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterType === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tümü
              </button>
              {(Object.keys(TX_TYPES) as TxType[]).map(t => {
                const cfg = TX_TYPES[t]
                return (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterType === t ? `${cfg.bg} ${cfg.color}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Clock className="text-gray-300" size={28} />
                </div>
                <p className="text-gray-400 text-sm">Bu gün için seans kaydı yok</p>
                <button
                  onClick={() => { setShowForm(true); setForm({ ...BLANK(), date: selected }) }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
                >
                  <Plus size={14} /> Seans Ekle
                </button>
              </div>
            ) : filtered.map(entry => {
              const cfg = TX_TYPES[entry.treatmentType]
              const sMeta = STATUS_META[entry.status]
              return (
                <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <cfg.Icon className={cfg.color} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className={`text-xs font-medium flex items-center gap-1 ${sMeta.cls}`}>
                          <sMeta.Icon size={12} /> {sMeta.label}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">Seans #{entry.sessionNumber}</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <User size={12} className="text-gray-400" />
                        <span className="text-sm font-semibold text-gray-800">{entry.patientName}</span>
                      </div>

                      {(entry.area || entry.dosage) && (
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          {entry.area   && <span>Bölge: <span className="font-medium text-gray-700">{entry.area}</span></span>}
                          {entry.dosage && <span>Doz: <span className="font-medium text-gray-700">{entry.dosage}</span></span>}
                        </div>
                      )}

                      {entry.notes && (
                        <div className="flex items-start gap-1.5 mt-1.5">
                          <FileText size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-gray-500 leading-relaxed">{entry.notes}</p>
                        </div>
                      )}

                      {entry.nextFollowUp && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Bell size={12} className="text-amber-500" />
                          <span className="text-xs text-amber-600 font-medium">
                            Kontrol: {fmt(entry.nextFollowUp)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <select
                        value={entry.status}
                        onChange={e => updateStatus(entry.id, e.target.value as TxStatus)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
                      >
                        <option value="planned">Planlandı</option>
                        <option value="completed">Tamamlandı</option>
                        <option value="cancelled">İptal</option>
                      </select>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors text-center"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Add entry modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                  <Plus className="text-teal-600" size={16} />
                </div>
                <span className="font-bold text-gray-900">Yeni Tedavi Seansı</span>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Hasta Adı *</label>
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    value={form.patientName}
                    onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Hasta ID</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.patientId || ''}
                    onChange={e => setForm(f => ({ ...f, patientId: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tedavi Türü *</label>
                  <select
                    value={form.treatmentType}
                    onChange={e => setForm(f => ({ ...f, treatmentType: e.target.value as TxType }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    {(Object.keys(TX_TYPES) as TxType[]).map(t => (
                      <option key={t} value={t}>{TX_TYPES[t].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Seans #</label>
                  <input
                    type="number" min="1"
                    value={form.sessionNumber}
                    onChange={e => setForm(f => ({ ...f, sessionNumber: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tarih *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Sonraki Kontrol</label>
                  <input
                    type="date"
                    value={form.nextFollowUp ?? ''}
                    onChange={e => setForm(f => ({ ...f, nextFollowUp: e.target.value || null }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Uygulama Bölgesi</label>
                  <input
                    type="text"
                    placeholder="örn. Alın, Glabella"
                    value={form.area}
                    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Doz / Miktar</label>
                  <input
                    type="text"
                    placeholder="örn. 20Ü, 1ml"
                    value={form.dosage}
                    onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Durum</label>
                <div className="flex gap-2">
                  {(Object.keys(STATUS_META) as TxStatus[]).map(s => {
                    const m = STATUS_META[s]
                    return (
                      <button
                        key={s}
                        onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-1 justify-center ${
                          form.status === s
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <m.Icon size={12} /> {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notlar</label>
                <textarea
                  rows={3}
                  placeholder="Hasta tepkisi, özel notlar…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-white transition-colors"
              >
                İptal
              </button>
              <button
                onClick={addEntry}
                disabled={!form.patientName.trim() || !form.date}
                className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  )
}

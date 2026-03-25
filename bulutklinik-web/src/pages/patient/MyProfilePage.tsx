import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientApi } from '../../services/patientApi'
import PatientLayout from '../../components/patient/PatientLayout'
import { CheckCircle, AlertCircle, Phone, Mail, User, Shield, Copy } from 'lucide-react'

export default function MyProfilePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ phoneNumber: '', fullName: '' })
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { document.title = 'Profilim – BulutKlinik' }, [])

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: patientApi.getProfile,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (profile) {
      setForm({ phoneNumber: profile.phoneNumber ?? '', fullName: profile.fullName ?? '' })
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: object) => patientApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  const copyId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(profile.id).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const roleLabel = (r: string) => r === 'Patient' ? 'Hasta' : r === 'Doctor' ? 'Doktor' : r
  const displayName = profile?.fullName || profile?.email?.split('@')[0] || '?'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <PatientLayout title="Profilim">
      <div className="max-w-2xl">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-48 animate-pulse" />)}
          </div>
        ) : profile ? (
          <div className="space-y-4">

            {/* Profile header card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{displayName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-semibold">
                      {roleLabel(profile.role)}
                    </span>
                    <span className="text-blue-200 text-xs">{profile.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info readonly */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h3 className="font-bold text-gray-800 mb-4">Hesap Bilgileri</h3>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail size={15} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">E-posta</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <User size={15} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Hesap Tipi</p>
                  <p className="text-sm font-semibold text-gray-800">{roleLabel(profile.role)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Shield size={15} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Kullanıcı ID</p>
                  <p className="text-xs font-mono text-gray-500 truncate">{profile.id}</p>
                </div>
                <button onClick={copyId} className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" title="Kopyala">
                  {copied ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Edit form */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-4">Bilgileri Düzenle</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-1.5">Ad Soyad</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="fullName"
                      type="text"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      placeholder="Adınız ve soyadınız"
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 mb-1.5">Telefon Numarası</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={form.phoneNumber}
                      onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="0555 123 45 67"
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {updateMutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {updateMutation.isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                  {saved && (
                    <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold">
                      <CheckCircle size={16} /> Kaydedildi
                    </span>
                  )}
                  {updateMutation.isError && (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm">
                      <AlertCircle size={16} /> Hata oluştu
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Güvenlik</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Şifre değişikliği ve hesap güvenliği işlemleri için lütfen destek ekibimizle iletişime geçin.
                  </p>
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </PatientLayout>
  )
}

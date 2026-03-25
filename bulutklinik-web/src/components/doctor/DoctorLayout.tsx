import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { doctorApi } from '../../services/doctorApi'
import {
  Home, CalendarDays, Users, Clock, Receipt, Package,
  LogOut, Menu, X, ChevronRight, Bell, Stethoscope, ScanFace, Webhook, UserCog, ClipboardList, ShieldCheck, Heart,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/doctor/dashboard',   label: 'Ana Sayfa',         Icon: Home },
  { to: '/doctor/calendar',    label: 'Takvim',            Icon: CalendarDays },
  { to: '/doctor/patients',    label: 'Hastalarım',        Icon: Users },
  { to: '/doctor/schedule',    label: 'Çalışma Saatleri',  Icon: Clock },
  { to: '/doctor/invoices',    label: 'Faturalar',         Icon: Receipt },
  { to: '/doctor/stock',       label: 'Stok',              Icon: Package },
  { to: '/doctor/asymmetry',   label: 'AI Analiz',         Icon: ScanFace },
  { to: '/doctor/integration', label: 'Entegrasyon',       Icon: Webhook },
  { to: '/doctor/team',               label: 'Ekip Yönetimi',        Icon: UserCog },
  { to: '/doctor/treatment-calendar', label: 'Tedavi Takip',         Icon: ClipboardList },
  { to: '/doctor/compliance',         label: 'Rıza & KVKK',          Icon: ShieldCheck },
  { to: '/doctor/reminders',          label: 'Otomatik Hatırlatma',  Icon: Bell },
  { to: '/doctor/crm',                label: 'Hasta CRM',            Icon: Heart },
]

interface Props {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
}

export default function DoctorLayout({ children, title, action }: Props) {
  const { userId, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const { data: doctor } = useQuery({
    queryKey: ['doctor-profile', userId],
    queryFn: () => doctorApi.getProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => { setOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  const fullLabel = doctor
    ? `${doctor.title ?? ''} ${doctor.fullName ?? ''}`.trim()
    : 'Doktor'
  const initials = (doctor?.fullName ?? 'DR')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white z-40 flex flex-col
        border-r border-gray-100
        transition-transform duration-300 ease-in-out
        lg:sticky lg:translate-x-0
        ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>

        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100 flex-shrink-0">
          <Link to="/doctor/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-200 group-hover:shadow-teal-300 transition-shadow">
              <Stethoscope className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">BulutKlinik</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Klinik Paneli</p>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">Menü</p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}
                        size={18}
                      />
                      <span className="flex-1">{label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-400" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{fullLabel}</p>
              <p className="text-[11px] text-gray-400 truncate">{doctor?.specialty ?? 'Doktor'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors font-medium mt-0.5"
          >
            <LogOut size={16} className="flex-shrink-0" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:max-h-screen lg:overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 gap-3 flex-shrink-0 sticky top-0 z-20">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Menüyü aç"
          >
            <Menu className="w-5 h-5" />
          </button>

          {title && (
            <h1 className="font-bold text-gray-900 text-base truncate">{title}</h1>
          )}

          <div className="ml-auto flex items-center gap-2">
            {action && <div>{action}</div>}
            <button className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Bell size={18} />
            </button>
            <div className="hidden lg:flex items-center gap-2.5 pl-2 border-l border-gray-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <span className="text-sm font-semibold text-gray-700">{fullLabel}</span>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

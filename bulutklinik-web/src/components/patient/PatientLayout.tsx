import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { patientApi } from '../../services/patientApi'
import {
  Home, Calendar, CalendarPlus, FileText, BarChart2,
  FolderOpen, User, LogOut, Menu, X, ChevronRight,
  Bell, Plus
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard',        label: 'Ana Sayfa',         Icon: Home },
  { to: '/my-appointments',  label: 'Randevularım',      Icon: Calendar },
  { to: '/my-records',       label: 'Muayene Geçmişi',   Icon: FileText },
  { to: '/my-measurements',  label: 'Ölçümlerim',        Icon: BarChart2 },
  { to: '/my-documents',     label: 'Belgelerim',        Icon: FolderOpen },
  { to: '/my-profile',       label: 'Profilim',          Icon: User },
]

interface Props {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
}

export default function PatientLayout({ children, title, action }: Props) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: patientApi.getProfile,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => { setOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  const displayName = profile?.fullName || profile?.email?.split('@')[0] || 'Hasta'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

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
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200 group-hover:shadow-blue-300 transition-shadow">
              <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Medica.AI</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Hasta Portalı</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="ml-auto lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Book appointment CTA */}
        <div className="px-3 pt-4 pb-2">
          <Link
            to="/book"
            className="flex items-center gap-2.5 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-200"
          >
            <CalendarPlus className="w-4 h-4" />
            Randevu Al
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-2">Menü</p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} size={18} />
                      <span className="flex-1">{label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/my-profile')}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{displayName}</p>
              <p className="text-[11px] text-gray-400 truncate">{profile?.email}</p>
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <span className="text-sm font-semibold text-gray-700">{displayName}</span>
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

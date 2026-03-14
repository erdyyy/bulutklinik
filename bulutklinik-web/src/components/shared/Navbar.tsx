import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function Navbar() {
  const { role, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          🏥 BulutKlinik
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {role === 'Doctor' && (
            <>
              <Link to="/doctor/dashboard" className="hover:underline">Dashboard</Link>
              <Link to="/doctor/calendar" className="hover:underline">Takvim</Link>
              <Link to="/doctor/schedule" className="hover:underline">Çalışma Saatleri</Link>
            </>
          )}
          {role === 'Patient' && (
            <>
              <Link to="/book" className="hover:underline">Randevu Al</Link>
              <Link to="/my-appointments" className="hover:underline">Randevularım</Link>
            </>
          )}
          <button
            onClick={handleLogout}
            className="bg-white text-blue-600 px-3 py-1 rounded font-medium hover:bg-blue-50"
          >
            Çıkış
          </button>
        </div>
      </div>
    </nav>
  )
}

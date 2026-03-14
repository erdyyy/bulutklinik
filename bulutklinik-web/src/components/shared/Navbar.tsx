import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function Navbar() {
  const { role, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow">
      <Link to="/" className="font-bold text-lg">BulutKlinik</Link>
      <div className="flex gap-4 items-center text-sm">
        {role === 'Patient' && (
          <>
            <Link to="/book" className="hover:underline">Randevu Al</Link>
            <Link to="/my-appointments" className="hover:underline">Randevularım</Link>
            <Link to="/my-records" className="hover:underline">Kayıtlarım</Link>
            <Link to="/my-measurements" className="hover:underline">Ölçümlerim</Link>
          </>
        )}
        {(role === 'Doctor' || role === 'Staff') && (
          <>
            <Link to="/doctor/dashboard" className="hover:underline">Dashboard</Link>
            <Link to="/doctor/calendar" className="hover:underline">Takvim</Link>
            <Link to="/doctor/patients" className="hover:underline">Hastalar</Link>
            <Link to="/doctor/invoices" className="hover:underline">Faturalar</Link>
            <Link to="/doctor/stock" className="hover:underline">Stok</Link>
          </>
        )}
        <button onClick={handleLogout} className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-semibold hover:bg-blue-50">
          Çıkış
        </button>
      </div>
    </nav>
  );
}

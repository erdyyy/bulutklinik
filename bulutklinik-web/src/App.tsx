import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/shared/ProtectedRoute'

import LoginPage            from './pages/auth/LoginPage'
import MyAppointmentsPage   from './pages/patient/MyAppointmentsPage'
import BookAppointmentPage  from './pages/patient/BookAppointmentPage'
import DashboardPage        from './pages/doctor/DashboardPage'
import CalendarPage         from './pages/doctor/CalendarPage'
import SchedulePage         from './pages/doctor/SchedulePage'

function HomeRedirect() {
  const { role, token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <Navigate to={role === 'Doctor' ? '/doctor/dashboard' : '/my-appointments'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Hasta */}
        <Route path="/my-appointments" element={
          <ProtectedRoute role="Patient"><MyAppointmentsPage /></ProtectedRoute>
        } />
        <Route path="/book" element={
          <ProtectedRoute role="Patient"><BookAppointmentPage /></ProtectedRoute>
        } />

        {/* Doktor */}
        <Route path="/doctor/dashboard" element={
          <ProtectedRoute role="Doctor"><DashboardPage /></ProtectedRoute>
        } />
        <Route path="/doctor/calendar" element={
          <ProtectedRoute role="Doctor"><CalendarPage /></ProtectedRoute>
        } />
        <Route path="/doctor/schedule" element={
          <ProtectedRoute role="Doctor"><SchedulePage /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

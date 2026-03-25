import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/shared/ProtectedRoute'

import LoginPage            from './pages/auth/LoginPage'
import PatientDashboardPage from './pages/patient/PatientDashboardPage'
import MyAppointmentsPage   from './pages/patient/MyAppointmentsPage'
import BookAppointmentPage  from './pages/patient/BookAppointmentPage'
import MyRecordsPage        from './pages/patient/MyRecordsPage'
import MyMeasurementsPage   from './pages/patient/MyMeasurementsPage'
import MyPrescriptionsPage  from './pages/patient/MyPrescriptionsPage'
import MyProfilePage        from './pages/patient/MyProfilePage'
import DoctorProfilePage   from './pages/patient/DoctorProfilePage'
import DashboardPage        from './pages/doctor/DashboardPage'
import CalendarPage         from './pages/doctor/CalendarPage'
import SchedulePage         from './pages/doctor/SchedulePage'
import PatientListPage      from './pages/doctor/PatientListPage'
import PatientDetailPage    from './pages/doctor/PatientDetailPage'
import InvoicesPage         from './pages/doctor/InvoicesPage'
import StockPage              from './pages/doctor/StockPage'
import AsymmetryAnalysisPage      from './pages/doctor/AsymmetryAnalysisPage'
import IntegrationSettingsPage    from './pages/doctor/IntegrationSettingsPage'
import TeamManagementPage         from './pages/doctor/TeamManagementPage'
import TreatmentCalendarPage      from './pages/doctor/TreatmentCalendarPage'
import SharedReportPage           from './pages/patient/SharedReportPage'
import CompliancePage             from './pages/doctor/CompliancePage'
import AutoRemindersPage         from './pages/doctor/AutoRemindersPage'
import CrmPage                   from './pages/doctor/CrmPage'

function HomeRedirect() {
  const { role, token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <Navigate to={role === 'Doctor' ? '/doctor/dashboard' : '/dashboard'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Hasta */}
        <Route path="/dashboard" element={
          <ProtectedRoute role="Patient"><PatientDashboardPage /></ProtectedRoute>
        } />
        <Route path="/my-appointments" element={
          <ProtectedRoute role="Patient"><MyAppointmentsPage /></ProtectedRoute>
        } />
        <Route path="/book" element={
          <ProtectedRoute role="Patient"><BookAppointmentPage /></ProtectedRoute>
        } />
        <Route path="/my-records" element={
          <ProtectedRoute role="Patient"><MyRecordsPage /></ProtectedRoute>
        } />
        <Route path="/my-measurements" element={
          <ProtectedRoute role="Patient"><MyMeasurementsPage /></ProtectedRoute>
        } />
        <Route path="/my-documents" element={
          <ProtectedRoute role="Patient"><MyPrescriptionsPage /></ProtectedRoute>
        } />
        <Route path="/my-profile" element={
          <ProtectedRoute role="Patient"><MyProfilePage /></ProtectedRoute>
        } />
        <Route path="/doctor/:doctorId/profile" element={
          <ProtectedRoute role="Patient"><DoctorProfilePage /></ProtectedRoute>
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
        <Route path="/doctor/patients" element={
          <ProtectedRoute role="Doctor"><PatientListPage /></ProtectedRoute>
        } />
        <Route path="/doctor/patients/:patientId" element={
          <ProtectedRoute role="Doctor"><PatientDetailPage /></ProtectedRoute>
        } />
        <Route path="/doctor/invoices" element={
          <ProtectedRoute role="Doctor"><InvoicesPage /></ProtectedRoute>
        } />
        <Route path="/doctor/stock" element={
          <ProtectedRoute role="Doctor"><StockPage /></ProtectedRoute>
        } />
        <Route path="/doctor/asymmetry" element={
          <ProtectedRoute role="Doctor"><AsymmetryAnalysisPage /></ProtectedRoute>
        } />
        <Route path="/doctor/integration" element={
          <ProtectedRoute role="Doctor"><IntegrationSettingsPage /></ProtectedRoute>
        } />
        <Route path="/doctor/team" element={
          <ProtectedRoute role="Doctor"><TeamManagementPage /></ProtectedRoute>
        } />
        <Route path="/doctor/treatment-calendar" element={
          <ProtectedRoute role="Doctor"><TreatmentCalendarPage /></ProtectedRoute>
        } />

        <Route path="/doctor/compliance" element={
          <ProtectedRoute role="Doctor"><CompliancePage /></ProtectedRoute>
        } />
        <Route path="/doctor/reminders" element={
          <ProtectedRoute role="Doctor"><AutoRemindersPage /></ProtectedRoute>
        } />
        <Route path="/doctor/crm" element={
          <ProtectedRoute role="Doctor"><CrmPage /></ProtectedRoute>
        } />

        {/* Public — giriş gerektirmez */}
        <Route path="/report/:token" element={<SharedReportPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

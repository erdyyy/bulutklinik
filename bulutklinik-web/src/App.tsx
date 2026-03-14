import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Navbar } from './components/shared/Navbar';
import { ProtectedRoute } from './components/shared/ProtectedRoute';

import { LoginPage } from './pages/auth/LoginPage';
import { BookAppointmentPage } from './pages/patient/BookAppointmentPage';
import { MyAppointmentsPage } from './pages/patient/MyAppointmentsPage';
import { MyRecordsPage } from './pages/patient/MyRecordsPage';
import { MyMeasurementsPage } from './pages/patient/MyMeasurementsPage';

import { DashboardPage } from './pages/doctor/DashboardPage';
import { CalendarPage } from './pages/doctor/CalendarPage';
import { ScheduleSettingsPage } from './pages/doctor/ScheduleSettingsPage';
import { PatientListPage } from './pages/doctor/PatientListPage';
import { PatientDetailPage } from './pages/doctor/PatientDetailPage';
import { InvoicesPage } from './pages/doctor/InvoicesPage';
import { StockPage } from './pages/doctor/StockPage';

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/book" element={
            <ProtectedRoute roles={['Patient']}>
              <Layout><BookAppointmentPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/my-appointments" element={
            <ProtectedRoute roles={['Patient']}>
              <Layout><MyAppointmentsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/my-records" element={
            <ProtectedRoute roles={['Patient']}>
              <Layout><MyRecordsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/my-measurements" element={
            <ProtectedRoute roles={['Patient']}>
              <Layout><MyMeasurementsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/doctor/dashboard" element={
            <ProtectedRoute roles={['Doctor', 'Staff']}>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/calendar" element={
            <ProtectedRoute roles={['Doctor', 'Staff']}>
              <Layout><CalendarPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/schedule" element={
            <ProtectedRoute roles={['Doctor']}>
              <Layout><ScheduleSettingsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/patients" element={
            <ProtectedRoute roles={['Doctor', 'Staff']}>
              <Layout><PatientListPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/patients/:id" element={
            <ProtectedRoute roles={['Doctor', 'Staff']}>
              <Layout><PatientDetailPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/invoices" element={
            <ProtectedRoute roles={['Doctor', 'Staff']}>
              <Layout><InvoicesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/stock" element={
            <ProtectedRoute roles={['Doctor', 'Staff']}>
              <Layout><StockPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

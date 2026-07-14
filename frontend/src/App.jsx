import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy load pages for dynamic code-splitting and performance tuning
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Kitchen = lazy(() => import('./pages/Kitchen'));
const Spa = lazy(() => import('./pages/Spa'));
const Shop = lazy(() => import('./pages/Shop'));
const Gym = lazy(() => import('./pages/Gym'));
const Supplies = lazy(() => import('./pages/Supplies'));
const Laundry = lazy(() => import('./pages/Laundry'));
const Accommodation = lazy(() => import('./pages/Accommodation'));
const Needs = lazy(() => import('./pages/Needs'));
const GeneralSupplies = lazy(() => import('./pages/GeneralSupplies'));
const Reports = lazy(() => import('./pages/Reports'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const RecycleBin = lazy(() => import('./pages/admin/RecycleBin'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Initialize = lazy(() => import('./pages/Initialize'));
const Settings = lazy(() => import('./pages/Settings'));

// A sleek, premium loader component matching the terracotta branding
function SuspenseFallback() {
  return (
    <div className="h-[75vh] w-full flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
      <Loader2 className="animate-spin text-[#A0604E]" size={36} strokeWidth={2.5} />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0604E]">Loading Swiss Side Module</span>
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem('swiss_side_session');
  const role = localStorage.getItem('swiss_side_role');

  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/initialize" element={<Initialize />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="kitchen" element={<ErrorBoundary><Kitchen /></ErrorBoundary>} />
          <Route path="spa" element={<ErrorBoundary><Spa /></ErrorBoundary>} />
          <Route path="shop" element={<ErrorBoundary><Shop /></ErrorBoundary>} />
          <Route path="gym" element={<ErrorBoundary><Gym /></ErrorBoundary>} />
          <Route path="supplies" element={<ErrorBoundary><Supplies /></ErrorBoundary>} />
          <Route path="laundry" element={<ErrorBoundary><Laundry /></ErrorBoundary>} />
          <Route path="accommodation" element={<ErrorBoundary><Accommodation /></ErrorBoundary>} />
          <Route path="accommodation/:propertyId" element={<ErrorBoundary><Accommodation /></ErrorBoundary>} />
          <Route path="accommodation/:propertyId/:houseId" element={<ErrorBoundary><Accommodation /></ErrorBoundary>} />
          <Route path="needs" element={<ErrorBoundary><Needs /></ErrorBoundary>} />
          <Route path="general-supplies" element={<ErrorBoundary><GeneralSupplies /></ErrorBoundary>} />
          <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />

          <Route path="admin/users" element={<ProtectedRoute><ErrorBoundary><UserManagement /></ErrorBoundary></ProtectedRoute>} />

          <Route path="admin" element={<ProtectedRoute adminOnly={true}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="recycle-bin" element={<ErrorBoundary><RecycleBin /></ErrorBoundary>} />
            <Route path="logs" element={<ErrorBoundary><AuditLogs /></ErrorBoundary>} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

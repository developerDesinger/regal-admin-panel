
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import UserManagement from './pages/UserManagement';
import CategoryManagement from './pages/CategoryManagement';
import TrendingDealsManagement from './pages/TrendingDealsManagement';
import PlatformFeeManagement from './pages/PlatformFeeManagement';
import ExecutiveDashboard from './pages/dashboard/ExecutiveDashboard';
import EventsManagement from './pages/dashboard/EventsManagement';
import TransactionsLedger from './pages/dashboard/TransactionsLedger';
import Reports from './pages/dashboard/Reports';
import RiskAlerts from './pages/dashboard/RiskAlerts';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    return <Navigate to="/" replace />; // Redirect to dashboard root which is now Executive Dashboard
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ExecutiveDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="events" element={<EventsManagement />} />
          <Route path="transactions" element={<TransactionsLedger />} />
          <Route path="reports" element={<Reports />} />
          <Route path="alerts" element={<RiskAlerts />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="trending-deals" element={<TrendingDealsManagement />} />
          <Route path="platform-fee" element={<PlatformFeeManagement />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

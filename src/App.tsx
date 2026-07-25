import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import UserPrefsSync from './components/UserPrefsSync';
import WhatsAppFloatingButton from './components/WhatsAppFloatingButton';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import GameAnalysisPage from './pages/GameAnalysisPage';
import GameReviewPage from './pages/GameReviewPage';
import ReportsPage from './pages/ReportsPage';
import PuzzlesPage from './pages/PuzzlesPage';
import ProfilePage from './pages/ProfilePage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

// Public Route Component (redirect to dashboard if logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isSignupOnboarding = location.pathname === '/register' && sessionStorage.getItem('signupOnboardingInProgress') === 'true';

  return !currentUser || isSignupOnboarding ? <>{children}</> : <Navigate to="/dashboard" />;
};

const AppShell: React.FC = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <div className="app-canvas min-h-screen">
      <Navbar />
      <div className={isLandingPage ? undefined : 'pt-[4.75rem] sm:pt-20'}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/game/:gameId"
            element={
              <ProtectedRoute>
                <GameReviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analyze"
            element={
              <ProtectedRoute>
                <GameAnalysisPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/puzzles"
            element={
              <ProtectedRoute>
                <PuzzlesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="/settings" element={<Navigate to="/profile" replace />} />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <WhatsAppFloatingButton />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserPrefsSync />
        <Router>
          <AppShell />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

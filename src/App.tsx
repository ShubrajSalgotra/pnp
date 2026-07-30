import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import UserPrefsSync from './components/UserPrefsSync';
import WhatsAppFloatingButton from './components/WhatsAppFloatingButton';

// Keep the lightest entry routes eager for first paint.
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';

// Everything else is code-split so reloads don't download unused feature code.
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const GameAnalysisPage = lazy(() => import('./pages/GameAnalysisPage'));
const OpponentPracticePage = lazy(() => import('./pages/OpponentPracticePage'));
const GameReviewPage = lazy(() => import('./pages/GameReviewPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const PuzzlesPage = lazy(() => import('./pages/PuzzlesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));

const RouteFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
  </div>
);

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
        <Suspense fallback={<RouteFallback />}>
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
              path="/analyze/practice"
              element={
                <ProtectedRoute>
                  <OpponentPracticePage />
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

            <Route
              path="/premium"
              element={
                <ProtectedRoute>
                  <PremiumPage />
                </ProtectedRoute>
              }
            />

            <Route path="/settings" element={<Navigate to="/profile" replace />} />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
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

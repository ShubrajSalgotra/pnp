import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import UserPrefsSync from './components/UserPrefsSync';
import WhatsAppFloatingButton from './components/WhatsAppFloatingButton';
import { AppLayout } from './components/layout/AppLayout';

// Keep the lightest entry routes eager for first paint.
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';

// Code-split pages for performance
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const GameAnalysisPage = lazy(() => import('./pages/GameAnalysisPage'));
const OpponentPracticePage = lazy(() => import('./pages/OpponentPracticePage'));
const GameReviewPage = lazy(() => import('./pages/GameReviewPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const PuzzlesPage = lazy(() => import('./pages/PuzzlesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const StudyPage = lazy(() => import('./pages/StudyPage'));
const LeaderboardPage = lazy(() => import('./components/Leaderboard'));

const RouteFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600 dark:border-slate-700 dark:border-t-emerald-400" />
  </div>
);

// Protected Student Route: wraps authenticated views in the persistent AppLayout shell
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  return <AppLayout>{children}</AppLayout>;
};

// Public Route Component (redirect to dashboard if logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isSignupOnboarding =
    location.pathname === '/register' &&
    sessionStorage.getItem('signupOnboardingInProgress') === 'true';

  return !currentUser || isSignupOnboarding ? <>{children}</> : <Navigate to="/dashboard" />;
};

const AppShell: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const isLandingPage = location.pathname === '/';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isPublicView = !currentUser || isLandingPage || isAuthPage;

  return (
    <div className="app-canvas min-h-screen">
      {/* Show floating top Navbar only on landing & auth pages, or when unauthenticated */}
      {isPublicView && <Navbar />}

      <div
        className={
          isPublicView
            ? isLandingPage
              ? undefined
              : 'pt-[4.75rem] sm:pt-20'
            : undefined
        }
      >
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

            {/* Protected Student Routes (with persistent sidebar layout) */}
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
              path="/practice"
              element={
                <ProtectedRoute>
                  <PracticePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <LeaderboardPage />
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
              path="/study"
              element={
                <ProtectedRoute>
                  <StudyPage />
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

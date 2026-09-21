import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';

// Pages
import { LoginPage } from './pages/login.page';
import { SignupPage } from './pages/signup.page';
import { DashboardPage } from './pages/dashboard.page';
import { ChatPage } from './pages/chat.page';

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

/**
 * Protected Route Component
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Public Route Component (redirects to dashboard if already authenticated)
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Main App Component
 */
export function App() {
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // Restore session once on load — do not tie to login/signup isLoading
  // or the router unmounts and form errors disappear.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchCurrentUser();
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCurrentUser]);

  if (isBootstrapping) {
    return <FullPageSpinner />;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
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
          path="/chat/:sessionId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 fallback */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-md">404</h1>
                <p className="text-neutral-400 mb-lg">Page not found</p>
                <a
                  href="/dashboard"
                  className="px-lg py-md bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition inline-block"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

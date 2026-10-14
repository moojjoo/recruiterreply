import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { UIProvider } from "./contexts/UIContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toast } from "./components/common/Toast";
import { CookieConsent } from "./components/common/CookieConsent";
import { AnalyticsRouteTracker } from "./components/analytics/AnalyticsRouteTracker";
import { CookiePolicy } from "./pages/CookiePolicy";
import "./index.css";

// Pages
import { HomePage } from "./pages/HomePage";
import { Login } from "./pages/Login";
import { PasswordRecovery } from "./pages/PasswordRecovery";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ReplyPage } from "./pages/ReplyPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { Profile } from "./pages/Profile";
import { GmailCallback } from "./pages/GmailCallback";
import { GoogleCallback } from "./pages/GoogleCallback";
import { Opportunities } from "./pages/Opportunities";
import { CareerProfile } from "./pages/CareerProfile";
import { RecruiterInbox } from "./pages/RecruiterInbox";
import { NotFound } from "./pages/NotFound";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Terms } from "./pages/Terms";
import { Pricing } from "./pages/Pricing";

function App({ server = false }: { server?: boolean }) {
  const Router = server ? MemoryRouter : BrowserRouter;
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <UIProvider>
              <AnalyticsRouteTracker />
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<PasswordRecovery />} />
                <Route path="/reset-password" element={<PasswordRecovery />} />
                <Route path="/policy" element={<PrivacyPolicy />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/pricing" element={<Pricing />} />

                {/* Protected Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analyze"
                  element={
                    <ProtectedRoute>
                      <AnalysisPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reply"
                  element={
                    <ProtectedRoute>
                      <ReplyPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/compare"
                  element={
                    <ProtectedRoute>
                      <ComparisonPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/opportunities"
                  element={
                    <ProtectedRoute>
                      <Opportunities />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/career-profile"
                  element={
                    <ProtectedRoute>
                      <CareerProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter-inbox"
                  element={
                    <ProtectedRoute>
                      <RecruiterInbox />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gmail/connected"
                  element={
                    <ProtectedRoute>
                      <GmailCallback />
                    </ProtectedRoute>
                  }
                />
                <Route path="/auth/google/callback" element={<GoogleCallback />} />

                {/* Catch-all */}
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>

              <Toast />
              <CookieConsent />
            </UIProvider>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

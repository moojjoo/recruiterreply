import { lazy, Suspense } from "react";
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
import { NotFound } from "./pages/NotFound";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Terms } from "./pages/Terms";
import { Pricing } from "./pages/Pricing";
import { GuidePage } from "./pages/GuidePage";
import { RouteMetadata } from "./seo/RouteMetadata";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage").then((module) => ({ default: module.AnalysisPage })));
const ReplyPage = lazy(() => import("./pages/ReplyPage").then((module) => ({ default: module.ReplyPage })));
const ComparisonPage = lazy(() => import("./pages/ComparisonPage").then((module) => ({ default: module.ComparisonPage })));
const Profile = lazy(() => import("./pages/Profile").then((module) => ({ default: module.Profile })));
const GmailCallback = lazy(() => import("./pages/GmailCallback").then((module) => ({ default: module.GmailCallback })));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback").then((module) => ({ default: module.GoogleCallback })));
const Opportunities = lazy(() => import("./pages/Opportunities").then((module) => ({ default: module.Opportunities })));
const CareerProfile = lazy(() => import("./pages/CareerProfile").then((module) => ({ default: module.CareerProfile })));
const RecruiterInbox = lazy(() => import("./pages/RecruiterInbox").then((module) => ({ default: module.RecruiterInbox })));

function App({ server = false, initialPath = "/" }: { server?: boolean; initialPath?: string }) {
  const Router = server ? MemoryRouter : BrowserRouter;
  return (
    <ErrorBoundary>
      <Router {...(server ? { initialEntries: [initialPath] } : {})}>
        <AuthProvider>
          <ToastProvider>
            <UIProvider>
              <RouteMetadata />
              <AnalyticsRouteTracker />
              <Suspense fallback={<div className="container py-16 text-center" role="status">Loading…</div>}>
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
                <Route path="/guides/:slug" element={<GuidePage />} />

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
              </Suspense>

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

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { UIProvider } from "./contexts/UIContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toast } from "./components/common/Toast";
import "./index.css";

// Pages
import { HomePage } from "./pages/HomePage";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ReplyPage } from "./pages/ReplyPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { Profile } from "./pages/Profile";
import { GmailCallback } from "./pages/GmailCallback";
import { GoogleCallback } from "./pages/GoogleCallback";
import { Opportunities } from "./pages/Opportunities";
import { NotFound } from "./pages/NotFound";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Terms } from "./pages/Terms";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <UIProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/policy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />

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
            </UIProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

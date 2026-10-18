import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { useToast } from "../hooks/useToast";
import { trackProductEvent } from "../utils/productAnalytics";
import { isCookieAuthEnabled } from "../services/authMode";

export const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) {
      return;
    }

    hasHandled.current = true;

    if (isCookieAuthEnabled()) {
      window.location.replace("/login?error=legacy_auth_retired");
      return;
    }

    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("authToken", token);
      trackProductEvent("login", { method: "google" });
      showToast("Google login successful.", "success");
      // AuthProvider owns the in-memory user state. Reloading after storing the
      // token lets its normal bootstrap call /auth/me before ProtectedRoute
      // evaluates the dashboard, avoiding an immediate redirect back to login.
      window.location.replace("/dashboard");
      return;
    }

    showToast("Google login failed. Please try again.", "error");
    navigate("/login", { replace: true });
  }, [navigate, searchParams, showToast]);

  return (
    <MainLayout>
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    </MainLayout>
  );
};

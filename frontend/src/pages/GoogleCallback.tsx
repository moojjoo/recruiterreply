import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { useToast } from "../hooks/useToast";

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

    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("authToken", token);
      showToast("Google login successful.", "success");
      navigate("/dashboard", { replace: true });
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

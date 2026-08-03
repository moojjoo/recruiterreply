import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { useToast } from "../hooks/useToast";

export const GmailCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) {
      return;
    }
    hasHandled.current = true;

    const connected = searchParams.get("connected") === "true";
    if (connected) {
      showToast("Gmail connected successfully.", "success");
    } else {
      const error = searchParams.get("error") || "unknown_error";
      showToast(`Failed to connect Gmail (${error}). Please try again.`, "error");
    }

    navigate("/profile", { replace: true });
  }, [searchParams, navigate, showToast]);

  return (
    <MainLayout>
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    </MainLayout>
  );
};

import React from "react";
import { useToast } from "../../hooks/useToast";

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`alert alert-${toast.type} animate-fade-in`}
          role="alert"
        >
          <span>
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✕"}
            {toast.type === "info" && "ℹ"}
            {toast.type === "warning" && "⚠"}
          </span>
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-auto text-lg leading-none hover:opacity-70"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

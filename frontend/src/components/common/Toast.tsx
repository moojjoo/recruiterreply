import React from "react";
import { useToast } from "../../hooks/useToast";

const palette = {
  success: "bg-emerald-950 text-white border-emerald-400",
  error: "bg-red-950 text-white border-red-400",
  info: "bg-slate-950 text-white border-sky-400",
  warning: "bg-amber-950 text-white border-amber-400",
} as const;

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-[calc(100vw-2rem)]" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg border-l-4 p-4 shadow-xl animate-fade-in ${palette[toast.type]}`}
          style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
          role="alert"
        >
          <span aria-hidden="true">
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✕"}
            {toast.type === "info" && "ℹ"}
            {toast.type === "warning" && "⚠"}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="ml-auto min-w-11 min-h-11 text-lg leading-none hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Close notification"
          >×</button>
        </div>
      ))}
    </div>
  );
};

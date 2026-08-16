import { createContext, useContext } from "react";
import { Toast } from "../types/index";

export interface ToastContextType {
  toasts: Toast[];
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(
  undefined,
);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

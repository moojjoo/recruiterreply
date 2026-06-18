import { useContext } from "react";
import { UIContext, UIContextType } from "../contexts/UIContext";

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
};

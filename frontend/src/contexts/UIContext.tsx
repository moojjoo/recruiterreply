import React, { useState, useCallback } from "react";
import { UIContext } from "../hooks/useUI";

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState<Record<string, boolean>>({});

  const openModal = useCallback((id: string) => {
    setModalOpen((prev) => ({ ...prev, [id]: true }));
  }, []);

  const closeModal = useCallback((id: string) => {
    setModalOpen((prev) => ({ ...prev, [id]: false }));
  }, []);

  const toggleModal = useCallback((id: string) => {
    setModalOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <UIContext.Provider
      value={{
        isLoading,
        setIsLoading,
        modalOpen,
        openModal,
        closeModal,
        toggleModal,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

import React, { useState, useCallback, useEffect } from "react";
import { AxiosError } from "axios";
import { User } from "../types/index";
import { authService } from "../services/api/authService";
import { AuthContext } from "../hooks/useAuth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (token) {
          const response = await authService.getCurrentUser();
          const currentUser = response.data;
          setUser(currentUser);
          localStorage.setItem("userData", JSON.stringify(currentUser));
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      const payload = response.data;
      setUser(payload.user);
      localStorage.setItem("authToken", payload.token);
      localStorage.setItem("userData", JSON.stringify(payload.user));
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.response?.data?.error : undefined;
      throw new Error(message || "Login failed", { cause: error });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setIsLoading(true);
      try {
        const response = await authService.register(email, password, name);
        const payload = response.data;
        setUser(payload.user);
        localStorage.setItem("authToken", payload.token);
        localStorage.setItem("userData", JSON.stringify(payload.user));
      } catch (error) {
        const message =
          error instanceof AxiosError
            ? error.response?.data?.error
            : undefined;
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        const safeMessage = typeof message === "string" && message.length <= 250 && (status === 400 || status === 409) ? message : undefined;
        const fallback = status === 409 ? "An account with this email already exists. Try signing in."
          : status === 400 ? "Please check your registration details and try again."
          : status === 429 ? "Too many attempts. Please try again later."
          : !status ? "Unable to connect to the registration service. Please try again."
          : "Registration is temporarily unavailable. Please try again later.";
        throw new Error(safeMessage || fallback, { cause: error });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userData");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

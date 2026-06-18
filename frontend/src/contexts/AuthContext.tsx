import React, { createContext, useState, useCallback, useEffect } from "react";
import { User } from "../types/index";

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

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
          // Verify token is still valid
          // For MVP, we'll just assume it's valid if it exists
          const userData = localStorage.getItem("userData");
          if (userData) {
            setUser(JSON.parse(userData));
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    try {
      // MVP: Mock authentication
      const mockUser: User = {
        id: "1",
        email,
        name: email.split("@")[0],
        createdAt: new Date(),
      };
      setUser(mockUser);
      localStorage.setItem("authToken", "mock-token-" + Date.now());
      localStorage.setItem("userData", JSON.stringify(mockUser));
    } catch (error) {
      throw new Error("Login failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, _password: string, name: string) => {
      setIsLoading(true);
      try {
        // MVP: Mock registration
        const mockUser: User = {
          id: "1",
          email,
          name,
          createdAt: new Date(),
        };
        setUser(mockUser);
        localStorage.setItem("authToken", "mock-token-" + Date.now());
        localStorage.setItem("userData", JSON.stringify(mockUser));
      } catch (error) {
        throw new Error("Registration failed");
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

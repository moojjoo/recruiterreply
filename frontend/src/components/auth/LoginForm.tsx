import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { authService } from "../../services/api/authService";

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      showToast("Logged in successfully!", "success");
      window.location.href = "/dashboard";
    } catch {
      showToast("Login failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const response = await authService.googleLoginStart();
      window.location.href = response.data.redirectUrl;
    } catch {
      showToast("Google login is currently unavailable.", "error");
      setGoogleLoading(false);
    }
  };

  return (
    <Card elevated>
      <h2 className="text-2xl font-bold mb-6">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Button type="submit" isLoading={loading} className="w-full">
          Sign In
        </Button>
      </form>

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          isLoading={googleLoading}
          className="w-full"
          onClick={handleGoogleLogin}
        >
          Continue with Google
        </Button>
      </div>

      <p className="text-sm text-gray-600 mt-4">
        Don't have an account?{" "}
        <a
          href="/register"
          className="text-primary-600 hover:underline font-medium"
        >
          Sign up
        </a>
      </p>
    </Card>
  );
};

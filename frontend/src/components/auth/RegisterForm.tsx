import { trackProductEvent } from "../../utils/productAnalytics";
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

export const RegisterForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const { register } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFormError("");
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      showToast("Passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name);
      trackProductEvent("sign_up", { method: "password" });
      showToast("Account created successfully!", "success");
      window.location.href = "/dashboard";
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card elevated>
      <h2 className="text-2xl font-bold mb-6">Create Account</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <p role="status" className="error-text">{formError}</p>}
        <Input
          type="text"
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          required
        />
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
        <Input
          type="password"
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Button type="submit" isLoading={loading} disabled={loading} className="w-full">
          Create Account
        </Button>
      </form>
      <p className="text-sm text-gray-600 mt-4">
        Already have an account?{" "}
        <a
          href="/login"
          className="text-primary-600 hover:underline font-medium"
        >
          Sign in
        </a>
      </p>
    </Card>
  );
};

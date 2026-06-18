import React from "react";
import { LoginForm } from "../components/auth/LoginForm";
import { MainLayout } from "../components/layout/MainLayout";

export const Login: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-md mx-auto">
        <LoginForm />
      </div>
    </MainLayout>
  );
};

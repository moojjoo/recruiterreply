import React from "react";
import { RegisterForm } from "../components/auth/RegisterForm";
import { MainLayout } from "../components/layout/MainLayout";

export const Register: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-md mx-auto">
        <RegisterForm />
      </div>
    </MainLayout>
  );
};

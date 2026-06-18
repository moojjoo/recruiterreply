import React from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { Button } from "../components/common/Button";

export const NotFound: React.FC = () => {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-64">
        <h1 className="text-6xl font-bold text-primary-600 mb-4">404</h1>
        <p className="text-2xl font-semibold text-gray-900 mb-2">
          Page Not Found
        </p>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Button onClick={() => (window.location.href = "/")}>Go Home</Button>
      </div>
    </MainLayout>
  );
};

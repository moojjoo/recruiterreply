import React from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { Card } from "../components/common/Card";

export const Profile: React.FC = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <Card elevated>
        <h1 className="text-3xl font-bold mb-6">Profile</h1>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Email</label>
            <p className="text-lg text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Name</label>
            <p className="text-lg text-gray-900">{user?.name}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Member Since
            </label>
            <p className="text-lg text-gray-900">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>
      </Card>
    </MainLayout>
  );
};

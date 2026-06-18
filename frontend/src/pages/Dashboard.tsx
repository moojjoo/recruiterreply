import React from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-8">
        <section>
          <h1 className="section-title mb-4">Welcome, {user?.name}! 👋</h1>
          <p className="text-lg text-gray-600 mb-8">
            Use the tools below to analyze recruiter messages, generate replies,
            and compare job offers.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/analyze"
            className="card hover:shadow-medium transition-all p-6 cursor-pointer"
          >
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-xl font-bold mb-2">Analyze Messages</h3>
            <p className="text-gray-600">
              Get insights on recruiter messages with AI-powered analysis
            </p>
          </a>

          <a
            href="/reply"
            className="card hover:shadow-medium transition-all p-6 cursor-pointer"
          >
            <div className="text-4xl mb-3">✉️</div>
            <h3 className="text-xl font-bold mb-2">Generate Replies</h3>
            <p className="text-gray-600">
              Create professional responses to recruiter emails instantly
            </p>
          </a>

          <a
            href="/compare"
            className="card hover:shadow-medium transition-all p-6 cursor-pointer"
          >
            <div className="text-4xl mb-3">⚖️</div>
            <h3 className="text-xl font-bold mb-2">Compare Offers</h3>
            <p className="text-gray-600">
              Evaluate and compare multiple job offers side by side
            </p>
          </a>
        </div>
      </div>
    </MainLayout>
  );
};

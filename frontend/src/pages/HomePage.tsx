import React from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const features = [
    {
      icon: "📊",
      title: "Message Analyzer",
      description:
        "Analyze recruiter emails to understand compensation, spot red flags, and get AI-powered insights.",
      id: "analyzer",
    },
    {
      icon: "✉️",
      title: "Reply Generator",
      description:
        "Generate professional replies to recruiters - express interest, ask for details, or decline politely.",
      id: "generator",
    },
    {
      icon: "⚖️",
      title: "Offer Comparison",
      description:
        "Compare multiple job offers side-by-side and get a recommendation based on total compensation.",
      id: "comparison",
    },
  ];

  const steps = [
    "Paste a recruiter message to get instant analysis and recommendations",
    "Generate professional AI-written replies in seconds",
    "Compare offers side-by-side with financial and quality-of-life metrics",
  ];

  return (
    <MainLayout>
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 bg-gradient-hero opacity-5" />
          <div className="container relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="section-title">
                Master Your Job Search with{" "}
                <span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                  AI Intelligence
                </span>
              </h1>
              <p className="section-subtitle">
                Get instant insights on recruiter messages, generate compelling
                responses, and compare offers like a pro. Powered by
                cutting-edge AI.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="btn-primary text-lg"
              >
                Get Started Now
              </button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.id} className="card group" role="article">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h2 className="text-2xl font-bold mb-3 text-gray-900">
                  {feature.title}
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {feature.description}
                </p>
                <button className="btn-secondary mt-6 w-full">
                  Learn More
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-accent-50 py-16 md:py-24">
          <div className="container max-w-3xl">
            <h2 className="section-title text-center mb-4">How It Works</h2>
            <p className="text-center text-gray-700 mb-12">
              Three simple steps to take control of your career narrative
            </p>

            <div className="space-y-6">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-start gap-6 card"
                  role="listitem"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-primary-600 to-accent-600 text-white font-bold text-lg">
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <p className="text-lg text-gray-900 font-semibold">
                      {step}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Highlight */}
        <section className="container py-16 md:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="section-title text-center mb-12">
              Why Choose RecruiterReply?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  title: "⚡ Instant Analysis",
                  desc: "Get comprehensive insights in seconds, not hours",
                },
                {
                  title: "🎯 AI-Powered",
                  desc: "Leverage advanced OpenAI models for expert guidance",
                },
                {
                  title: "🔒 Privacy First",
                  desc: "Your data stays secure with no storage of personal information",
                },
                {
                  title: "💼 Professional",
                  desc: "Generate polished, ready-to-send responses every time",
                },
              ].map((feature, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-success-100 text-success-700">
                      ✓
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-gray-700">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-16 md:py-24">
          <div className="absolute inset-0 bg-gradient-hero" />
          <div className="container relative z-10">
            <div className="card-elevated max-w-2xl mx-auto text-center bg-white">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Transform Your Job Search?
              </h2>
              <p className="text-lg text-gray-700 mb-8">
                Join thousands of professionals who are negotiating better
                offers with confidence.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="btn-primary text-lg"
              >
                Start Your Free Analysis
              </button>
            </div>
          </div>
        </section>
      </main>
    </MainLayout>
  );
};

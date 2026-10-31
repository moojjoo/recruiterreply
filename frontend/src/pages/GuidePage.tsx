import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { guides } from "../seo/guides";

export const GuidePage: React.FC = () => {
  const { slug } = useParams();
  const guide = guides.find((item) => item.slug === slug);
  if (!guide) return <Navigate to="/404" replace />;

  const url = `https://recruiterreply.com/guides/${guide.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      url,
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: "RecruiterReply" },
      publisher: { "@type": "Organization", name: "RecruiterReply", url: "https://recruiterreply.com/" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://recruiterreply.com/" },
        { "@type": "ListItem", position: 2, name: guide.title, item: url },
      ],
    },
  ];

  return (
    <MainLayout>
      <article className="max-w-4xl mx-auto">
        {structuredData.map((data) => (
          <script
            key={data["@type"]}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
          />
        ))}
        <nav aria-label="Breadcrumb" className="text-sm text-gray-600 mb-8">
          <Link to="/" className="text-primary-800 hover:underline">Home</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span>Guides</span>
        </nav>
        <header className="border-b border-gray-200 pb-8 mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{guide.eyebrow}</p>
          <h1 className="text-4xl font-bold text-gray-900 mt-2">{guide.title}</h1>
          <p className="text-xl text-gray-700 leading-8 mt-6">{guide.intro}</p>
        </header>
        <div className="space-y-10 text-gray-700 leading-7">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{section.heading}</h2>
              <div className="space-y-4">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            </section>
          ))}
        </div>
        <aside className="mt-12 rounded-xl bg-primary-50 p-8">
          <h2 className="text-2xl font-semibold text-gray-900">Make your next recruiter conversation clearer</h2>
          <p className="mt-3 text-gray-700">Analyze messages, compare opportunities, and prepare a reply you can review before sending.</p>
          <Link to="/register" className="btn-primary inline-block mt-6">Start your free analysis</Link>
        </aside>
      </article>
    </MainLayout>
  );
};

import React from "react";
import { MainLayout } from "../components/layout/MainLayout";

const sections = [
  {
    title: "1. Acceptance of These Terms",
    content: (
      <p>
        Welcome to RecruiterReply. These Terms and Conditions govern your access to and use of the RecruiterReply website and application. By creating an account, accessing, or using the service, you agree to these terms and our Privacy Policy. If you do not agree, do not use RecruiterReply.
      </p>
    ),
  },
  {
    title: "2. Eligibility and Accounts",
    content: (
      <>
        <p>
          You must be at least 16 years old and legally able to enter into this agreement. You are responsible for providing accurate account information, protecting your credentials, and all activity under your account. Notify us promptly if you believe your account has been compromised.
        </p>
        <p>
          You may sign in with email and password or an enabled third-party provider such as Google. You must have the right to authorize any third-party account that you connect.
        </p>
      </>
    ),
  },
  {
    title: "3. The Service",
    content: (
      <p>
        RecruiterReply provides tools for organizing recruiting information, analyzing messages, comparing opportunities, and drafting replies. We may change, suspend, or discontinue features, including third-party integrations, when reasonably necessary to operate or improve the service.
      </p>
    ),
  },
  {
    title: "4. Your Content",
    content: (
      <>
        <p>
          You retain ownership of the messages, job information, documents, and other content you submit to RecruiterReply. You grant us a limited, worldwide license to host, process, transmit, and display that content only as needed to provide, secure, and improve the service and meet legal obligations.
        </p>
        <p>
          You represent that you have the rights and permissions required to submit your content and authorize any connected account or integration. You are responsible for making sure your use of recruiting and candidate information complies with applicable law and your organization’s policies.
        </p>
      </>
    ),
  },
  {
    title: "5. AI-Generated and Informational Output",
    content: (
      <>
        <p>
          RecruiterReply may use automated or AI-assisted features to generate analyses, suggestions, summaries, or draft replies. Outputs may be incomplete, inaccurate, or unsuitable for your situation and are provided for informational purposes only.
        </p>
        <p>
          You are responsible for reviewing, editing, and approving all output before relying on it or sending it to another person. RecruiterReply does not provide legal, financial, employment, or professional advice and does not make hiring decisions for you.
        </p>
      </>
    ),
  },
  {
    title: "6. Acceptable Use",
    content: (
      <>
        <p>You may not use RecruiterReply to:</p>
        <ul>
          <li>Break the law, violate another person’s rights, or process personal information without a lawful basis.</li>
          <li>Upload malware, harmful code, or content that interferes with the service.</li>
          <li>Attempt to gain unauthorized access, probe our systems, or bypass security controls.</li>
          <li>Scrape, resell, copy, or exploit the service except as expressly permitted.</li>
          <li>Harass, deceive, discriminate against, or harm another person.</li>
          <li>Send unsolicited messages or use generated content for spam or abuse.</li>
        </ul>
      </>
    ),
  },
  {
    title: "7. Third-Party Services",
    content: (
      <p>
        RecruiterReply may integrate with services such as Google and Gmail. Those services have their own terms and privacy policies. We are not responsible for the availability, accuracy, security, or practices of third-party services. You can disconnect an integration through the available account controls or the third party’s settings.
      </p>
    ),
  },
  {
    title: "8. Intellectual Property",
    content: (
      <p>
        RecruiterReply and its software, design, trademarks, documentation, and service content are owned by RecruiterReply or its licensors and are protected by applicable intellectual property laws. These terms grant you a limited, non-exclusive, non-transferable right to use the service for its intended purpose. No other rights are transferred to you.
      </p>
    ),
  },
  {
    title: "9. Fees and Changes",
    content: (
      <p>
        If paid features are introduced, their pricing and billing terms will be presented before purchase. We may change pricing or plan features with reasonable notice where required. You are responsible for applicable taxes and for maintaining a valid payment method when payment is required.
      </p>
    ),
  },
  {
    title: "10. Disclaimer of Warranties",
    content: (
      <p>
        To the maximum extent permitted by law, RecruiterReply is provided on an “as is” and “as available” basis. We do not warrant that the service will be uninterrupted, error-free, secure, or suitable for every purpose, or that generated output will be accurate or complete.
      </p>
    ),
  },
  {
    title: "11. Limitation of Liability",
    content: (
      <p>
        To the maximum extent permitted by law, RecruiterReply and its team will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, revenue, profits, or opportunities arising from your use of the service. Nothing in these terms limits liability that cannot legally be limited.
      </p>
    ),
  },
  {
    title: "12. Suspension and Termination",
    content: (
      <p>
        You may stop using RecruiterReply and request account deletion at any time. We may suspend or terminate access if you breach these terms, create risk for the service or another person, or where required by law. Provisions that by their nature should survive termination, including ownership, disclaimers, limitations, and dispute provisions, will continue to apply.
      </p>
    ),
  },
  {
    title: "13. Changes to These Terms",
    content: (
      <p>
        We may update these terms as the service or legal requirements change. We will update the effective date and provide additional notice for material changes where required. Your continued use of RecruiterReply after an update means you accept the revised terms.
      </p>
    ),
  },
  {
    title: "14. Governing Law and Contact",
    content: (
      <>
        <p>
          These terms are governed by the laws applicable to RecruiterReply’s operating jurisdiction, without regard to conflict-of-law rules. Any mandatory consumer or privacy rights in your place of residence remain unaffected.
        </p>
        <p>
          Questions about these terms can be sent to{" "}
          <a className="text-primary-600 hover:underline" href="mailto:legal@recruiterreply.com">
            legal@recruiterreply.com
          </a>
          .
        </p>
      </>
    ),
  },
];

export const Terms: React.FC = () => {
  return (
    <MainLayout>
      <article className="max-w-4xl mx-auto">
        <header className="border-b border-gray-200 pb-8 mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 mt-2">Terms and Conditions</h1>
          <p className="text-gray-600 mt-4">Effective date: August 13, 2026</p>
          <p className="text-gray-700 mt-6 max-w-3xl">
            These terms explain the rules for using RecruiterReply, including your responsibilities when using recruiting content, integrations, and AI-assisted features.
          </p>
        </header>

        <div className="space-y-8 text-gray-700 leading-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{section.title}</h2>
              <div className="space-y-3">{section.content}</div>
            </section>
          ))}
        </div>
      </article>
    </MainLayout>
  );
};

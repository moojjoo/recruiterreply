import React from "react";
import { MainLayout } from "../components/layout/MainLayout";

const sections = [
  {
    title: "1. Information We Collect",
    content: (
      <>
        <p>
          We collect information you provide directly, information created when you use RecruiterReply, and limited technical information needed to operate the service.
        </p>
        <ul>
          <li>Account information such as your name, email address, and authentication details.</li>
          <li>Recruiting content you choose to submit, including messages, job offers, analyses, replies, and opportunities.</li>
          <li>Google account information when you choose Google sign-in, such as your email address, name, profile picture, and Google account identifier.</li>
          <li>Gmail data only when you explicitly connect Gmail, including messages and metadata required for the features you enable.</li>
          <li>Technical information such as device, browser, approximate location, IP address, and service activity used for security and reliability.</li>
        </ul>
      </>
    ),
  },
  {
    title: "2. How We Use Information",
    content: (
      <>
        <p>We use information to:</p>
        <ul>
          <li>Create and secure your account and authenticate you.</li>
          <li>Provide message analysis, reply generation, offer comparison, opportunity tracking, and other requested features.</li>
          <li>Maintain, troubleshoot, improve, and protect RecruiterReply.</li>
          <li>Communicate with you about your account, service updates, and security matters.</li>
          <li>Detect fraud, abuse, unauthorized access, and violations of our terms.</li>
          <li>Meet legal obligations and enforce our agreements.</li>
        </ul>
        <p>
          We do not sell your personal information. We do not use your private recruiting content for advertising.
        </p>
      </>
    ),
  },
  {
    title: "3. Google and Gmail Access",
    content: (
      <>
        <p>
          Google sign-in is optional. If you use it, Google shares the profile information needed to create or access your RecruiterReply account. We use that information only for authentication and account management.
        </p>
        <p>
          Gmail access is separate from Google sign-in and requires your explicit authorization. We access only the Gmail data needed for the Gmail features you enable. You can disconnect Gmail at any time from your account settings or revoke access through your Google Account security settings.
        </p>
      </>
    ),
  },
  {
    title: "4. Sharing and Service Providers",
    content: (
      <>
        <p>
          We share information only as needed to provide the service, comply with law, or protect users. Service providers may process information on our behalf for hosting, databases, authentication, email, security, analytics, or AI-assisted features. They are required to protect information and use it only for authorized purposes.
        </p>
        <p>
          We may disclose information if required by law, to respond to valid legal process, or to protect the rights, safety, and integrity of RecruiterReply and its users. If RecruiterReply is involved in a merger, acquisition, or asset transfer, information may be transferred as part of that transaction subject to applicable law.
        </p>
      </>
    ),
  },
  {
    title: "5. Storage and Security",
    content: (
      <p>
        We use administrative, technical, and organizational safeguards designed to protect personal information, including access controls, encrypted connections, authentication controls, and protected secret storage. No online service can guarantee absolute security. You are responsible for keeping your credentials confidential and notifying us promptly about suspected unauthorized access.
      </p>
    ),
  },
  {
    title: "6. Retention",
    content: (
      <p>
        We retain information for as long as needed to provide the service, maintain business and security records, resolve disputes, enforce agreements, and meet legal obligations. Retention periods vary by the type of information and how you use the service. When information is no longer needed, we delete it or anonymize it where reasonably possible.
      </p>
    ),
  },
  {
    title: "7. Your Privacy Rights",
    content: (
      <>
        <p>
          Depending on where you live, you may have the right to access, correct, delete, or receive a copy of your personal information; restrict or object to certain processing; withdraw consent; and complain to a data protection authority.
        </p>
        <p>
          California residents may also have rights under the CCPA/CPRA, including the right to know, delete, correct, and opt out of the sale or sharing of personal information. RecruiterReply does not sell personal information or share it for cross-context behavioral advertising.
        </p>
        <p>
          To submit a privacy request, contact us using the details below. We may verify your identity before completing a request, and we will respond within the period required by applicable law.
        </p>
      </>
    ),
  },
  {
    title: "8. Cookies and Similar Technologies",
    content: (
      <p>
        RecruiterReply may use essential cookies or local storage to keep you signed in, preserve preferences, and protect the service. We may use limited diagnostic technologies to understand reliability and performance. You can control cookies through your browser, but disabling essential storage may prevent parts of the service from working.
      </p>
    ),
  },
  {
    title: "9. Children’s Privacy",
    content: (
      <p>
        RecruiterReply is not directed to children under 16, and we do not knowingly collect personal information from children under 16. If you believe a child has provided personal information, please contact us so we can take appropriate action.
      </p>
    ),
  },
  {
    title: "10. International Transfers",
    content: (
      <p>
        Your information may be processed in countries other than the country where you live. When required, we use appropriate safeguards for international transfers and protect information in accordance with this policy and applicable law.
      </p>
    ),
  },
  {
    title: "11. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy as RecruiterReply changes or legal requirements develop. We will update the effective date and provide additional notice for material changes where required.
      </p>
    ),
  },
];

export const PrivacyPolicy: React.FC = () => {
  return (
    <MainLayout>
      <article className="max-w-4xl mx-auto">
        <header className="border-b border-gray-200 pb-8 mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 mt-2">Privacy Policy</h1>
          <p className="text-gray-600 mt-4">Effective date: August 13, 2026</p>
          <p className="text-gray-700 mt-6 max-w-3xl">
            This Privacy Policy explains how RecruiterReply collects, uses, stores, and protects information when you use our website and application.
          </p>
        </header>

        <div className="space-y-8 text-gray-700 leading-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{section.title}</h2>
              <div className="space-y-3">{section.content}</div>
            </section>
          ))}

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p>
              For privacy questions or requests, contact the RecruiterReply team at{" "}
              <a className="text-primary-600 hover:underline" href="mailto:privacy@recruiterreply.com">
                privacy@recruiterreply.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </MainLayout>
  );
};

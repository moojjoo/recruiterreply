import React from "react";
import { MainLayout } from "../components/layout/MainLayout";

export const CookiePolicy: React.FC = () => (
  <MainLayout>
    <article className="mx-auto max-w-4xl space-y-5 text-gray-900 dark:text-white">
      <h1 className="text-4xl font-bold">Cookie Policy</h1>
      <p>Last updated: October 11, 2026. RecruiterReply uses essential browser storage for authentication and appearance preferences, and optional Google Analytics for aggregate website usage insights.</p>
      <h2 className="text-xl font-semibold">Essential storage</h2>
      <p>Essential browser storage includes authentication tokens and user session information, theme preferences, and your cookie preference record (rr-cookie-consent-v1). These are used to operate the service and remember your settings.</p>
      <h2 className="text-xl font-semibold">Optional analytics</h2>
      <p>With your consent, Google Analytics 4 may set first-party cookies such as _ga and _ga_* to distinguish browsers and measure site usage. Google controls its analytics cookie expiration according to its configuration and policies. We do not enable advertising personalization through this consent interface.</p>
      <h2 className="text-xl font-semibold">Your choices</h2>
      <p>Optional analytics is disabled until you choose to allow it. You may reject analytics without losing access to core features. Select Cookie Settings in the site footer to change your choice. Withdrawing consent prevents subsequent optional analytics collection; some previously collected information may remain subject to the provider's retention settings.</p>
      <h2 className="text-xl font-semibold">Contact</h2>
      <p>Questions or requests: <a className="underline" href="mailto:privacy@recruiterreply.com">privacy@recruiterreply.com</a>.</p>
    </article>
  </MainLayout>
);

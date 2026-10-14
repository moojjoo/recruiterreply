import "./ErrorPage.css";

const messages: Record<number, { title: string; detail: string }> = {
  400: { title: "We couldn't process that request", detail: "Check the information and try again." },
  401: { title: "Sign in required", detail: "Please sign in to continue securely." },
  403: { title: "Access restricted", detail: "You don't have permission to view this resource." },
  404: { title: "Page not found", detail: "The page may have moved or the address may be incorrect." },
  408: { title: "Request timed out", detail: "The connection took too long. Please try again." },
  429: { title: "Too many requests", detail: "Please wait a moment before trying again." },
  500: { title: "Something went wrong", detail: "We're having trouble completing your request." },
  502: { title: "Service temporarily unavailable", detail: "We're having trouble reaching the service." },
  503: { title: "We'll be back shortly", detail: "This service is temporarily unavailable." },
  504: { title: "Service timed out", detail: "The service is taking longer than expected." },
};
export interface ErrorPageProps {
  status?: number;
  referenceId?: string;
  onRetry?: () => void;
}
export function ErrorPage({ status = 500, referenceId, onRetry }: ErrorPageProps) {
  const message = messages[status] ?? messages[500];
  return (
    <main className="rr-error-shell">
      <section className="rr-error-card" role="alert" aria-labelledby="rr-error-title">
        <a href="/" className="rr-error-brand" aria-label="RecruiterReply home">Recruiter<span>Reply</span></a>
        <div className="rr-error-code" aria-hidden="true">{status}</div>
        <h1 id="rr-error-title">{message.title}</h1>
        <p>{message.detail}</p>
        <div className="rr-error-actions">
          {onRetry && <button type="button" onClick={onRetry} className="rr-error-primary">Try again</button>}
          {status === 401 && <a className="rr-error-primary" href="/login">Sign in</a>}
          <a className={status === 401 || onRetry ? "rr-error-secondary" : "rr-error-primary"} href="/">Return home</a>
        </div>
        {referenceId && <div className="rr-error-reference">Reference: <code>{referenceId}</code> <button type="button" onClick={() => { if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(referenceId).catch(() => {}); }} aria-label="Copy error reference">Copy</button></div>}
        <p className="rr-error-footnote">RecruiterReply · Your AI job search assistant</p>
      </section>
    </main>
  );
}

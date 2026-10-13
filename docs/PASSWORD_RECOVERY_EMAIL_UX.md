# Password recovery email UX — #358

Password recovery sends an AWS SES multipart email with both HTML and plain-text bodies. The six-digit code is visibly selectable in the HTML message, and the same code appears in plain text for clients that disable HTML. The recovery link and existing ten-minute expiry remain unchanged.

## Copy limitations

Gmail, Outlook, and most mobile email clients block email JavaScript and clipboard APIs. A button inside the email would not reliably copy anything, so this template deliberately does **not** show a Copy button. Users select the code and copy/paste it into the existing recovery page. The recovery page supports normal paste and browser one-time-code autofill. No code is embedded in email images or tracking pixels.

## Verification before deployment

- Run `dotnet test backend/RecruiterReply.Tests/RecruiterReply.Tests.csproj` (or the repository's equivalent test command).
- Verify the HTML and text parts in SES test messages on Gmail web/mobile and Outlook web/mobile; manually select and paste the code.
- Verify valid code, expired code, reused code, rate-limited request and recovery link flows in Dev without writing codes or links to logs.
- Verify no analytics events, redirects, logs or referrers capture recovery tokens; this change does not add any such collection.
- Obtain owner approval before merge or deployment. Dev, Test and Production remain separately gated.

The code and recovery link are sensitive; do not paste them into issue comments, CI logs, analytics, or screenshots.

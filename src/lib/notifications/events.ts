export interface NotificationDelivery {
  to: string[];
  subject: string;
  text: string;
}

export function renderIssueUrl(issueId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/issues/${issueId}`;
}

export function buildIssueEmail(input: { subject: string; body: string; issueId: string }): NotificationDelivery {
  return {
    to: [],
    subject: input.subject,
    text: `${input.body}\n\nOpen issue: ${renderIssueUrl(input.issueId)}`,
  };
}

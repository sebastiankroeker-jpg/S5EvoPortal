type ResendMailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type ResendMailResult =
  | {
      status: "sent";
      response: unknown;
    }
  | {
      status: "skipped";
      reason: "missing_env";
      missing: string[];
    };

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendResendMail(payload: ResendMailPayload): Promise<ResendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    const missing = [
      ...(!apiKey ? ["RESEND_API_KEY"] : []),
      ...(!from ? ["MAIL_FROM"] : []),
    ];
    console.warn("Mail skipped: missing mail env", { missing });
    return { status: "skipped", reason: "missing_env", missing };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }

  return {
    status: "sent",
    response: await response.json(),
  };
}

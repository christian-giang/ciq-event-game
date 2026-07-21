import { Resend } from "resend";

/**
 * EMAIL_DRIVER=console (local dev): prints the mail to the terminal.
 * EMAIL_DRIVER=resend  (preview/prod): sends via Resend.
 * Email is the *backup* channel — signup shows the code on screen; only
 * repeat signups and "lost my code" rely on this.
 */
export async function sendAccessCodeEmail(opts: {
  to: string;
  code: string;
}): Promise<void> {
  const subject = "Your Combat IQ game access code";
  const text = [
    `Welcome to the Combat IQ team event game!`,
    ``,
    `Your access code: ${opts.code}`,
    ``,
    `Keep this code to yourself — it's how you log in.`,
  ].join("\n");

  if ((process.env.EMAIL_DRIVER ?? "console") === "console") {
    console.log(
      `\n=== EMAIL (console driver) ===\nTo: ${opts.to}\nSubject: ${subject}\n\n${text}\n==============================\n`,
    );
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("EMAIL_DRIVER=resend but RESEND_API_KEY is not set");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Combat IQ Game <onboarding@resend.dev>",
    to: opts.to,
    subject,
    text,
    html: accessCodeHtml(opts.code),
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}

export type TestEmailResult = { driver: string; ok: boolean; message: string };

/**
 * Sends a diagnostic email and reports what happened — never throws, so the
 * admin UI can show the exact outcome (wrong driver, missing key, unverified
 * domain, or success with the Resend id).
 */
export async function sendTestEmail(to: string): Promise<TestEmailResult> {
  const driver = process.env.EMAIL_DRIVER ?? "console";
  const subject = "Test email — Combat IQ game";
  const text =
    "If you're reading this, Resend is set up correctly for the Combat IQ game. 🎉";

  if (driver === "console") {
    console.log(
      `\n=== EMAIL (console driver) ===\nTo: ${to}\nSubject: ${subject}\n\n${text}\n==============================\n`,
    );
    return {
      driver,
      ok: false,
      message:
        "EMAIL_DRIVER is 'console' — the message was printed to the server logs, not sent. Set EMAIL_DRIVER=resend (plus RESEND_API_KEY and EMAIL_FROM) and redeploy to send real email.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { driver, ok: false, message: "RESEND_API_KEY is not set." };
  }

  const from = process.env.EMAIL_FROM ?? "Combat IQ Game <onboarding@resend.dev>";
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      text,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#2b2b2b;">${text}</div>`,
    });
    if (error) {
      return { driver, ok: false, message: `Resend rejected it: ${error.message}` };
    }
    return {
      driver,
      ok: true,
      message: `Sent to ${to} from "${from}". Check the inbox (and spam). Resend id: ${data?.id ?? "—"}`,
    };
  } catch (e) {
    return {
      driver,
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error sending email.",
    };
  }
}

/** Branded HTML version of the access-code email (inline styles for email
 *  clients). The code is digits-only, so no escaping is needed. */
function accessCodeHtml(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f3;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e7e5e0;">
      <tr><td style="padding:32px 32px 4px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8a8a84;">Combat IQ &middot; Team event</p>
        <h1 style="margin:0;font-size:24px;font-weight:600;">Your access code</h1>
      </td></tr>
      <tr><td style="padding:8px 32px 0;">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#57564f;">This code is how you log in to the game. Keep it to yourself.</p>
      </td></tr>
      <tr><td style="padding:0 32px;">
        <div style="background:#f5f5f3;border:1px solid #e7e5e0;border-radius:12px;padding:20px;text-align:center;">
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:0.18em;">${code}</span>
        </div>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;">
        <p style="margin:0;font-size:13px;line-height:1.5;color:#8a8a84;">Lost this email? Just sign up again with the same address and we'll re-send it.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

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

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Combat IQ Game <onboarding@resend.dev>",
    to: opts.to,
    subject,
    text,
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}

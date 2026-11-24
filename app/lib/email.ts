import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export class EmailDeliveryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "EmailDeliveryError";
    this.cause = cause;
  }
}

function getEmailSender() {
  const sender = process.env.EMAIL_FROM;
  if (!resend || !sender) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  }
  return { resend, sender };
}

export async function sendVerificationEmail({
  email,
  name,
  url,
}: {
  email: string;
  name: string;
  url: string;
}) {
  const { resend: client, sender } = getEmailSender();
  let result: Awaited<ReturnType<typeof client.emails.send>>;
  try {
    result = await client.emails.send({
      from: sender,
      to: email,
      subject: "Verify your QueuePilot email",
      text: `Hello ${name},\n\nVerify your QueuePilot account using this link:\n${url}\n\nIf you did not create an account, you can ignore this email.`,
    });
  } catch (error) {
    throw new EmailDeliveryError("The verification email could not be sent.", error);
  }

  if (result.error) {
    throw new EmailDeliveryError("The verification email could not be sent.", result.error);
  }
}

export async function sendPasswordResetEmail({
  email,
  name,
  url,
}: {
  email: string;
  name: string;
  url: string;
}) {
  const { resend: client, sender } = getEmailSender();
  const result = await client.emails.send({
    from: sender,
    to: email,
    subject: "Reset your QueuePilot password",
    text: `Hello ${name},\n\nReset your QueuePilot password using this link:\n${url}\n\nIf you did not request a reset, you can ignore this email.`,
  });

  if (result.error) {
    throw new EmailDeliveryError("The password reset email could not be sent.");
  }
}

export function isEmailConfigured() {
  return Boolean(resend && process.env.EMAIL_FROM);
}

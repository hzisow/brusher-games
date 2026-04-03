import nodemailer from "nodemailer";

const APP_NAME = process.env.APP_NAME || "The Brusher Games";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("Email not configured: SMTP_USER and SMTP_PASS must be set");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  baseUrl: string,
): Promise<void> {
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">${APP_NAME}</h2>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <h3 style="color: #555;">Password Reset Request</h3>
      <p>You requested a password reset. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #4f46e5; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p style="color: #888; font-size: 14px;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color: #888; font-size: 14px;">
        Or copy and paste this link into your browser:<br />
        <a href="${resetLink}" style="color: #4f46e5;">${resetLink}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #aaa; font-size: 12px;">&copy; ${APP_NAME}</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `${APP_NAME} - Password Reset`,
    html,
  });
}

export async function sendAdminNotification(
  adminEmail: string,
  subject: string,
  details: string,
): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">${APP_NAME} - Admin Notification</h2>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p>${details}</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #aaa; font-size: 12px;">&copy; ${APP_NAME}</p>
    </div>
  `;

  await sendEmail({
    to: adminEmail,
    subject: `${APP_NAME} - ${subject}`,
    html,
  });
}

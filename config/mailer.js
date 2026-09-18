import nodemailer from "nodemailer";

// null when EMAIL_HOST isn't set (local dev, tests) - MailerService treats that as "log instead
// of send" rather than crashing on a missing SMTP config.
const transporter = process.env.EMAIL_HOST
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
        secure: process.env.EMAIL_PORT === "465",
        auth: process.env.EMAIL_USER ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } : undefined,
    })
    : null;

export default transporter;

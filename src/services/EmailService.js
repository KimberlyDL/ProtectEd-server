// src/services/EmailService.js
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            secure: process.env.MAIL_PORT == 465, // true for 465, false for other ports
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD,
            },
        });
    }

    /**
     * Generic sender
     */
    async sendEmail({ to, subject, html }) {
        const mailOptions = {
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html,
        };

        return await this.transporter.sendMail(mailOptions);
    }

    /**
     * Feature: Email Verification
     */
    async sendVerificationEmail(user, token) {
        const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}&email=${user.email}`;
        return await this.sendEmail({
            to: user.email,
            subject: 'Verify your email - Maestro',
            html: `<h1>Welcome ${user.name || ''}!</h1>
                   <p>Please verify your email by clicking the link below:</p>
                   <a href="${url}">Verify Email</a>`
        });
    }

    /**
     * Feature: Password Reset
     */
    async sendPasswordResetEmail(user, token) {
        const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${user.email}`;
        return await this.sendEmail({
            to: user.email,
            subject: 'Reset your password - Maestro',
            html: `<p>You requested a password reset. Click the link below to proceed:</p>
                   <a href="${url}">Reset Password</a>
                   <p>This link expires in 1 hour.</p>`
        });
    }
}

module.exports = new EmailService();
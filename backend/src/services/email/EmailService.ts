import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Get or create SMTP transporter
   */
  static getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const config: EmailConfig = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
      secure: env.SMTP_SECURE,
    };

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    logger.info('Email transporter created', { host: config.host, port: config.port });
    return this.transporter;
  }

  /**
   * Send OTP email
   */
  static async sendOTPEmail(to: string, otp: string, purpose: 'signup' | 'signin'): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
    try {
      const transporter = this.getTransporter();

      const purposeText = purpose === 'signup' ? 'Sign Up' : 'Sign In';
      const mailOptions = {
        from: `"Smart AI Explorer" <${env.SMTP_FROM}>`,
        to,
        subject: `Your Smart AI Explorer OTP - ${purposeText}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Smart AI Explorer</h2>
            <p>Your ${purposeText} verification code is:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code will expire in <strong>5 minutes</strong>.</p>
            <p style="color: #6b7280; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
        text: `Smart AI Explorer - Your ${purposeText} verification code is: ${otp}. This code will expire in 5 minutes.`,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info('OTP email sent', { to, messageId: info.messageId });

      // Ethereal Email provides a preview URL for testing
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info('Email preview URL', { previewUrl });
      }

      return { success: true, previewUrl: previewUrl || undefined };
    } catch (err) {
      logger.error('Failed to send OTP email', err);
      return { success: false, error: 'Failed to send email. Please try again.' };
    }
  }

  /**
   * Verify SMTP connection
   */
  static async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (err) {
      logger.error('SMTP connection failed', err);
      return false;
    }
  }
}

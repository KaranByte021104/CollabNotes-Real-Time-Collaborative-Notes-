import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendOtpEmail(email: string, name: string, otp: string): Promise<void> {
    try {
      const year = new Date().getFullYear();
      await this.mailerService.sendMail({
        to: email,
        subject: 'CollabNotes - Password Reset Verification Code',
        template: './otp',
        context: {
          name,
          otp,
          year,
        },
      });
      this.logger.log(`Password reset OTP successfully sent to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset OTP to: ${email}`, error.stack);
      throw error;
    }
  }
}

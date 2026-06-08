import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { PasswordResetOtp } from '../entities/password-reset-otp.entity';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetOtp)
    private readonly otpRepository: Repository<PasswordResetOtp>,
    private readonly mailService: MailService,
  ) {}

  async requestOtp(email: string): Promise<{ message: string }> {
    const lowercaseEmail = email.toLowerCase().trim();

    // Check rate limit cooldown (60 seconds)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentOtp = await this.otpRepository.findOne({
      where: {
        email: lowercaseEmail,
        createdAt: MoreThan(oneMinuteAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentOtp) {
      throw new BadRequestException('Please wait 60 seconds before requesting another code.');
    }

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email: lowercaseEmail } });

    // Prevent email enumeration: return success even if user not found
    if (!user) {
      return { message: 'If an account exists with that email, a password reset code has been sent.' };
    }

    // Invalidate all previous unused OTPs for this user
    await this.otpRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true }
    );

    // Generate 6-digit OTP
    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    // Set expiry to 15 minutes in the future
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Save OTP
    const otpRecord = new PasswordResetOtp();
    otpRecord.userId = user.id;
    otpRecord.email = lowercaseEmail;
    otpRecord.otp = hashedOtp;
    otpRecord.expiresAt = expiresAt;
    await this.otpRepository.save(otpRecord);

    // Send email (async, but we await it to catch errors or log properly)
    try {
      await this.mailService.sendOtpEmail(lowercaseEmail, user.name, plainOtp);
    } catch (error) {
      // Log error but don't expose SMTP failures to frontend, return same generic message
      console.error('Failed to send OTP email:', error);
    }

    return { message: 'If an account exists with that email, a password reset code has been sent.' };
  }

  async verifyOtpAndResetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const lowercaseEmail = email.toLowerCase().trim();

    // Find the latest active (unused, not expired) OTP for this email
    const now = new Date();
    const activeOtps = await this.otpRepository.find({
      where: {
        email: lowercaseEmail,
        isUsed: false,
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });

    if (activeOtps.length === 0) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    // Find the correct matching OTP (there might be multiple within 15 minutes, but the latest is index 0)
    let matchedOtpRecord: PasswordResetOtp | null = null;
    for (const record of activeOtps) {
      const isValid = await bcrypt.compare(otp, record.otp);
      if (isValid) {
        matchedOtpRecord = record;
        break;
      }
    }

    if (!matchedOtpRecord) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    // Mark the matched OTP as used
    matchedOtpRecord.isUsed = true;
    await this.otpRepository.save(matchedOtpRecord);

    // Update the user's password
    const user = await this.userRepository.findOne({ where: { id: matchedOtpRecord.userId } });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    // Hash and update password
    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Password reset successfully.' };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.password) {
      throw new BadRequestException('User not found.');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect current password.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Password updated successfully.' };
  }
}

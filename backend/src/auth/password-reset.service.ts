import { Injectable, BadRequestException, UnauthorizedException, HttpStatus, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { PasswordResetOtp } from '../entities/password-reset-otp.entity';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';

// Custom class for TooManyRequestsException as NestJS doesn't have it built-in directly
class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetOtp)
    private readonly otpRepository: Repository<PasswordResetOtp>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getJwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET', 'supersecretjwtsecretkeyshouldbechangedinproduction');
  }

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
      throw new TooManyRequestsException('Please wait before requesting another code.');
    }

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email: lowercaseEmail } });

    // Prevent email enumeration: return success even if user not found
    if (!user) {
      return { message: 'If an account with that email exists, you will receive a reset code shortly.' };
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
    otpRecord.isUsed = false;
    await this.otpRepository.save(otpRecord);

    // Send email using MailService
    try {
      await this.mailService.sendOtpEmail(lowercaseEmail, user.name, plainOtp);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new ServiceUnavailableException('Failed to send OTP email. Please try again.');
    }

    return { message: 'If an account with that email exists, you will receive a reset code shortly.' };
  }

  async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const lowercaseEmail = email.toLowerCase().trim();

    // Find the latest unused OTP for this email
    const record = await this.otpRepository.findOne({
      where: {
        email: lowercaseEmail,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code. Please request a new one.');
    }

    // Compare plain OTP against stored hash
    const isOtpValid = await bcrypt.compare(otp, record.otp);
    if (!isOtpValid) {
      throw new BadRequestException('Incorrect code. Please try again.');
    }

    // Find user to include in token payload
    const user = await this.userRepository.findOne({ where: { id: record.userId } });
    if (!user) {
      throw new BadRequestException('Invalid or expired code. Please request a new one.');
    }

    // Generate signed JWT reset token
    const payload = {
      sub: user.id,
      email: user.email,
      purpose: 'password_reset',
      otpId: record.id,
    };

    const resetToken = this.jwtService.sign(payload, {
      secret: this.getJwtSecret(),
      expiresIn: '10m',
    });

    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(resetToken, {
        secret: this.getJwtSecret(),
      });
    } catch (error) {
      throw new UnauthorizedException('Reset token is invalid or has expired. Please start over.');
    }

    if (payload.purpose !== 'password_reset') {
      throw new UnauthorizedException('Invalid token purpose.');
    }

    // Find OTP record
    const otpRecord = await this.otpRepository.findOne({ where: { id: payload.otpId } });
    if (!otpRecord || otpRecord.isUsed) {
      throw new BadRequestException('This reset link has already been used. Please request a new code.');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('Reset code has expired. Please request a new one.');
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await this.otpRepository.save(otpRecord);

    // Hash new password and save to User
    const user = await this.userRepository.findOne({ where: { id: otpRecord.userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Password reset successfully. You can now log in with your new password.' };
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
      throw new UnauthorizedException('Current password is incorrect.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Password updated successfully.' };
  }
}

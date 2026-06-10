import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, name?: string, bio?: string, email?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (name !== undefined) {
      if (name.trim().length < 2 || name.trim().length > 60) {
        throw new BadRequestException('Name must be between 2 and 60 characters.');
      }
      user.name = name.trim();
    }

    if (bio !== undefined) {
      if (bio.length > 160) {
        throw new BadRequestException('Bio must not exceed 160 characters.');
      }
      user.bio = bio.trim();
    }

    if (email !== undefined) {
      const lowercaseEmail = email.toLowerCase().trim();
      if (lowercaseEmail !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: lowercaseEmail },
        });
        if (existingUser) {
          throw new BadRequestException('Email already in use.');
        }
        user.email = lowercaseEmail;
      }
    }

    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate file presence
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed.');
    }

    // Validate size (5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size must be under 5MB.');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `avatar-${userId}-${timestamp}.jpg`;
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    const destPath = path.join(avatarsDir, filename);

    // Make sure dir exists
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    // Resize, convert, compress and save
    try {
      await sharp(file.buffer)
        .resize(256, 256, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toFile(destPath);
    } catch (err) {
      console.error('Sharp processing failed:', err);
      throw new BadRequestException('Failed to process image.');
    }

    // Delete old avatar file if it exists
    if (user.avatarUrl) {
      const oldFilename = user.avatarUrl.replace('/uploads/avatars/', '');
      const oldPath = path.join(avatarsDir, oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to delete old avatar:', e);
        }
      }
    }

    // Update user entity
    user.avatarUrl = `/uploads/avatars/${filename}`;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result;
  }

  async deleteAvatar(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.avatarUrl) {
      const { password, ...result } = user;
      return result;
    }

    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    const filename = user.avatarUrl.replace('/uploads/avatars/', '');
    const filePath = path.join(avatarsDir, filename);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Failed to delete avatar file:', e);
      }
    }

    user.avatarUrl = null;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result;
  }
}

import { Controller, Get, Patch, Post, Delete, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsOptional, Length, MaxLength } from 'class-validator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Name must be between 2 and 60 characters.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Bio must not exceed 160 characters.' })
  bio?: string;
}

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@CurrentUser() user: any) {
    return this.profileService.getProfile(user.userId);
  }

  @Patch()
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    if (dto.name === undefined && dto.bio === undefined) {
      throw new BadRequestException('At least one of name or bio must be provided.');
    }
    return this.profileService.updateProfile(user.userId, dto.name, dto.bio);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadAvatar(user.userId, file);
  }

  @Delete('avatar')
  async deleteAvatar(@CurrentUser() user: any) {
    return this.profileService.deleteAvatar(user.userId);
  }
}

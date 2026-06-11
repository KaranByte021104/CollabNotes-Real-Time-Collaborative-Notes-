import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'supersecretjwtsecretkeyshouldbechangedinproduction'),
    });
  }

  async validate(payload: any) {
    if (payload.purpose === 'password_reset') {
      throw new UnauthorizedException('Invalid token purpose.');
    }
    return { userId: payload.sub, email: payload.email, name: payload.name };
  }
}

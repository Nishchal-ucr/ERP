import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../user/entities/user.entity';

export interface JwtPayload {
  sub: number;
  phone: string;
  role: 'OWNER' | 'SUPERVISOR';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key', // In production, use environment variable
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // In a real application, you would fetch the user from the database
    // For now, we'll return the payload data
    return {
      id: payload.sub,
      phone: payload.phone,
      role: payload.role,
    } as User;
  }
}

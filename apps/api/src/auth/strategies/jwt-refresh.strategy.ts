import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';

function extractFromCookie(req: Request): string | null {
  return req?.cookies?.['refresh_token'] ?? null;
}

// Token-based (header) clients call /auth/refresh with the refresh token in the
// Authorization: Bearer header; cookie-based clients still send it as a cookie.
const extractToken = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  extractFromCookie,
]);

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: extractToken,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';

function extractFromCookie(req: Request): string | null {
  return req?.cookies?.['access_token'] ?? null;
}

// Mobile Safari/Chrome block the cross-domain (third-party) auth cookie, so we
// also accept the token from the Authorization: Bearer header. The header wins
// when present; the cookie remains a fallback for existing cookie-based clients.
const extractToken = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  extractFromCookie,
]);

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET environment variable is required');
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

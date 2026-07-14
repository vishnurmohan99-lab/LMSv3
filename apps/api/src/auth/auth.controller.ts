import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './jwt-payload.interface';

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.register(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    // Tokens are also returned in the body so header-based clients (mobile, where
    // the cross-domain cookie is blocked) can store and send them themselves.
    return { user, accessToken, refreshToken };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user, accessToken, refreshToken };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(200)
  async refresh(@CurrentUser() payload: JwtPayload, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.refresh(payload);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user, accessToken, refreshToken };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    // Must clear with the SAME attributes the cookies were set with. In prod the
    // cookies are SameSite=None; Secure (cross-domain), and browsers reject a
    // cross-site Set-Cookie that isn't SameSite=None; Secure — so a bare
    // clearCookie() is silently dropped and the session never actually ends.
    const options = this.cookieBaseOptions();
    res.clearCookie('access_token', options);
    res.clearCookie('refresh_token', options);
    return { success: true };
  }

  @UseGuards(JwtAccessGuard)
  @Get('me')
  me(@CurrentUser() payload: JwtPayload) {
    return { user: payload };
  }

  // Frontends and API live on different registrable domains (e.g. vercel.app vs
  // onrender.com) in production, so SameSite=Lax would block the cookie on
  // cross-site requests entirely. Set and clear must use identical attributes.
  private cookieBaseOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const base = this.cookieBaseOptions();
    res.cookie('access_token', accessToken, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE_MS });
  }
}

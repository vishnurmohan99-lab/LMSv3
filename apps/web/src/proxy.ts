import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

type SiteRole = 'STUDENT' | 'FACULTY';

const ROLE_HOME: Record<SiteRole, string> = {
  STUDENT: '/student/dashboard',
  FACULTY: '/faculty/dashboard',
};

const ROLE_PREFIX: Record<SiteRole, string> = {
  STUDENT: '/student',
  FACULTY: '/faculty',
};

async function getRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.role as string) ?? null;
  } catch {
    return null;
  }
}

function isSiteRole(role: string | null): role is SiteRole {
  return role === 'STUDENT' || role === 'FACULTY';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = ['/student', '/faculty'].some((p) => pathname.startsWith(p));
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  const role = await getRole(request);

  if (isProtected) {
    if (!isSiteRole(role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!pathname.startsWith(ROLE_PREFIX[role])) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
  }

  if (isAuthPage && isSiteRole(role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/faculty/:path*', '/login', '/register'],
};

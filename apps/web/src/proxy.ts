import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

type Role = 'STUDENT' | 'FACULTY' | 'ADMIN';

const ROLE_HOME: Record<Role, string> = {
  STUDENT: '/student/dashboard',
  FACULTY: '/faculty/dashboard',
  ADMIN: '/admin/dashboard',
};

const ROLE_PREFIX: Record<Role, string> = {
  STUDENT: '/student',
  FACULTY: '/faculty',
  ADMIN: '/admin',
};

async function getRole(request: NextRequest): Promise<Role | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.role as Role) ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = ['/student', '/faculty', '/admin'].some((p) => pathname.startsWith(p));
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  const role = await getRole(request);

  if (isProtected) {
    if (!role) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!pathname.startsWith(ROLE_PREFIX[role])) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
  }

  if (isAuthPage && role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/faculty/:path*', '/admin/:path*', '/login', '/register'],
};

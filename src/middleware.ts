import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isApkMode } from "@/lib/mode";

const SESSION_COOKIE_NAME = "winur_session";

/**
 * Cek lapisan pertama: cookie sesi harus ada untuk akses /admin/* dan
 * /child/*. Verifikasi tanda tangan + role dilakukan di layout (Server
 * Component) karena modul `crypto` Node tidak tersedia di Edge runtime.
 *
 * Decision #3: build APK (Capacitor) hanya mode anak — /admin diblok total
 * saat NEXT_PUBLIC_MODE=apk.
 */
export function middleware(request: NextRequest) {
  if (isApkMode && request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME);

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/child/:path*"],
};

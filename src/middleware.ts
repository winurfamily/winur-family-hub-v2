import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isApkMode } from "@/lib/mode";
import { verifySessionTokenEdge } from "@/lib/session-edge";

const SESSION_COOKIE_NAME = "winur_session";

/**
 * Gerbang pertama untuk /admin/* dan /child/*.
 *
 * Sebelumnya middleware hanya memeriksa KEBERADAAN cookie — cookie palsu apa
 * pun lolos ke layout. Sekarang tanda tangan HMAC-nya diverifikasi di Edge
 * (lihat lib/session-edge.ts) dan perannya ikut dicek, sehingga profil anak
 * tidak bisa membuka /admin sama sekali. Layout Server Component tetap
 * memverifikasi ulang — middleware adalah lapisan tambahan, bukan pengganti.
 *
 * Decision #3: build APK (Capacitor) hanya mode anak — /admin diblok total
 * saat NEXT_PUBLIC_MODE=apk.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");

  if (isApkMode && isAdminRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionTokenEdge(token);

  if (!session) {
    const response = NextResponse.redirect(new URL("/", request.url));
    // Cookie tidak valid/kedaluwarsa ikut dibuang supaya tidak terus-menerus
    // memicu pengalihan pada permintaan berikutnya.
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  if (isAdminRoute && session.role !== "admin") {
    return NextResponse.redirect(new URL(`/child/${session.profileId}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/child/:path*"],
};

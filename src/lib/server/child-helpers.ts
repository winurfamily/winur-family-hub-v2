import "server-only";
import { getCurrentSession } from "@/app/actions/auth";

/** Pastikan session aktif adalah child dengan profileId sesuai childId. Null jika tidak. */
export async function requireChild(childId: string) {
  const session = await getCurrentSession();
  if (!session || session.role !== "child" || session.profileId !== childId) return null;
  return session;
}

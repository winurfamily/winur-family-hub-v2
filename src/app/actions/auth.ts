"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";
import { isApkMode } from "@/lib/mode";
import type { ProfileRole } from "@/lib/supabase/types";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

export interface FamilyState {
  familyId: string;
  setupComplete: boolean;
}

export interface PickerProfile {
  id: string;
  name: string;
  role: ProfileRole;
  age: number | null;
  level: number;
  photoUrl: string | null;
  pinLength: number;
}

/**
 * Ambil status family pertama (single-family app). Null jika belum ada.
 */
export async function getFamilyState(): Promise<FamilyState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("families")
    .select("id, setup_complete")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return { familyId: data.id, setupComplete: data.setup_complete };
}

/**
 * Ambil daftar profile untuk Profile Picker, lengkap dengan avatar aktif.
 *
 * Decision #3/#9: build APK hanya mode anak — profile admin disembunyikan
 * dari picker saat NEXT_PUBLIC_MODE=apk.
 */
export async function getProfilesForPicker(familyId: string): Promise<PickerProfile[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("profiles")
    .select("id, name, role, age, level, photo_url, active_avatar_id")
    .eq("family_id", familyId)
    .eq("status", "active");

  if (isApkMode) {
    query = query.eq("role", "child");
  }

  const { data, error } = await query
    .order("role", { ascending: true }) // 'admin' < 'child' alfabetis -> admin tampil dulu
    .order("name", { ascending: true });

  if (error || !data) return [];

  const avatarIds = data.map((p) => p.active_avatar_id).filter((id): id is string => Boolean(id));
  const avatarMap = new Map<string, string>();
  if (avatarIds.length > 0) {
    const { data: avatars } = await supabase.from("avatars").select("id, image_url").in("id", avatarIds);
    avatars?.forEach((a) => avatarMap.set(a.id, a.image_url));
  }

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    age: p.age,
    level: p.level,
    photoUrl: p.photo_url ?? (p.active_avatar_id ? avatarMap.get(p.active_avatar_id) ?? null : null),
    pinLength: p.role === "admin" ? 6 : 4,
  }));
}

export interface VerifyPinResult {
  success: boolean;
  error?: string;
  profile?: {
    id: string;
    name: string;
    role: ProfileRole;
  };
}

/**
 * Verifikasi PIN profile. Jika cocok, buat session cookie.
 */
export async function verifyPin(profileId: string, pin: string): Promise<VerifyPinResult> {
  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, family_id, name, role, pin")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !profile) {
    return { success: false, error: "Profil tidak ditemukan." };
  }

  if (isApkMode && profile.role !== "child") {
    return { success: false, error: "Profil tidak ditemukan." };
  }

  if (!profile.pin) {
    return { success: false, error: "PIN belum diatur untuk profil ini." };
  }

  const match = await bcrypt.compare(pin, profile.pin);
  if (!match) {
    return { success: false, error: "PIN salah, coba lagi." };
  }

  const payload: SessionPayload = {
    profileId: profile.id,
    familyId: profile.family_id,
    role: profile.role,
  };

  const token = createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return {
    success: true,
    profile: { id: profile.id, name: profile.name, role: profile.role },
  };
}

/**
 * Ambil session aktif dari cookie (dipakai di Server Component / route guard).
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/**
 * Logout / switch profile — hapus session cookie.
 */
export async function logoutSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

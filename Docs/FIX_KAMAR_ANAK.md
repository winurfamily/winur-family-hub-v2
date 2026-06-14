# PROMPT PERBAIKAN — KAMAR ANAK SAJA (Fullscreen + Hotspot Presisi)
# Paste ke Claude Code. HANYA perbaiki kamar anak. JANGAN sentuh bagian lain.

---

## RUANG LINGKUP
HANYA halaman kamar anak (`/child/[profileId]`). JANGAN ubah:
- Backend, DB, auth, server actions, API, Zustand logic
- Admin, profile picker, halaman lain
Referensi visual & sistem: `Docs/ROOM_DAFFA_FINAL.html` (buka di browser).

---

## 1. FULLSCREEN TANPA GARIS HITAM (WAJIB)

Masalah saat ini: kamar ada bar hitam di tablet. Perbaiki agar background SELALU memenuhi layar di iPad (4:3) & Android (16:10) tanpa bar hitam.

### Aturan render:
- Container kamar `.room-viewport`: `position:fixed; inset:0; width:100vw; height:100vh; overflow:hidden`
- Background image: `width:100%; height:100%; object-fit:cover; object-position:center` (ATAU `background-size:cover; background-position:center`)
- **JANGAN** pakai `contain` (itu penyebab bar hitam)
- Gambar tema rasio **16:10**. Di iPad (4:3) ter-crop ~8% kiri-kanan (aman, furniture di zona tengah). Di Android (16:10) pas penuh.
- Lock orientasi **landscape** untuk kamar anak (CSS + Capacitor screen orientation)

### Koordinat objek & hotspot ikut background (anti-geser saat crop):
- Buat 1 layer `.stage` berukuran mengikuti background yang sudah ter-cover (bukan ukuran layar mentah)
- Avatar, pet, celengan, hotspot, notif → semua child dari `.stage`, posisinya dalam **persen relatif ke `.stage`**
- Saat background di-`cover` & ter-crop, `.stage` ikut ter-crop sama → hotspot tetap nempel di furniture-nya di semua device
- Implementasi: hitung skala cover (`scale = max(vw/imgW, vh/imgH)`), set `.stage` width=imgW*scale, height=imgH*scale, center via translate. Semua koordinat % child relatif ke `.stage`.

---

## 2. KOORDINAT HOTSPOT (untuk tema "rocket", gambar 16:10)

Gunakan koordinat ini (persen terhadap `.stage`). Sudah dikalibrasi ke gambar `assets/themes/rocket_day.png`:

| Hotspot | Aksi | left% | top% | width% | height% |
|---|---|---|---|---|---|
| Jendela | Siang/Malam | 40 | 12 | 20 | 34 |
| Lemari | Ganti Baju/Kostum | 70 | 28 | 17 | 34 |
| Meja belajar | Tugas | 78 | 58 | 21 | 26 |
| Rak/Nakas (kiri kasur) | Riwayat | 4 | 60 | 13 | 24 |
| Kasur | Pilih Tema | 11 | 44 | 30 | 34 |

Notif tugas (glow) di atas meja: `left:88% top:50%`.

Walkable area (lantai, bottom-based %): `{ xMin:30, xMax:70, bMin:8, bMax:26 }`
Posisi default objek: avatar `{x:40,b:14}`, pet `{x:55,b:10}`, celengan `{x:62,b:10}`.

> Koordinat ini bagian dari **theme config** (lihat poin 4). Tema lain punya koordinat sendiri.

---

## 3. PERBAIKAN AREA KLIK (HOTSPOT)

- Hotspot = div transparan absolute di `.stage`, `z-index:2`, koordinat dari config
- Hover (desktop) = highlight tipis; mobile = langsung tap
- Hotspot HARUS selalu bisa diklik → objek (avatar/pet/celengan) TIDAK boleh menutupinya (collision, poin 5)
- Tambah dev toggle "Lihat Hotspot" (outline kuning) untuk QA — sembunyikan di production
- Tap di lantai (bukan hotspot, bukan objek) → avatar jalan ke titik itu (clamp ke walkableArea)
- Prioritas event: objek (klik sendiri) > hotspot > lantai. Pastikan `stopPropagation` benar.

---

## 4. THEME CONFIG (data-driven)

Kamar dirender dari config, supaya tambah tema TANPA ubah kode:
```ts
type RoomTheme = {
  id, name,
  dayImage, nightImage,         // URL Supabase Storage, rasio 16:10
  imgW: 1586, imgH: 992,        // dimensi asli untuk hitung cover-scale
  hotspots: { id, action:'daynight'|'avatar'|'task'|'history'|'theme', left,top,w,h, label, icon }[],
  walkableArea: { xMin,xMax,bMin,bMax },
  defaultPosition: { avatar:{x,b}, pet:{x,b}, piggy:{x,b} }
};
```
- Simpan di tabel `room_themes` (config JSONB). Active theme di `profiles.active_theme_id`.
- Ganti tema (klik kasur) → ganti dayImage/nightImage + relayout objek ke defaultPosition (collision-safe) + transisi crossfade.

---

## 5. COLLISION & SAFE AREA (WAJIB)

- Avatar/Pet/Celengan tidak boleh overlap hotspot
- Drop/relayout objek di zona hotspot → auto-geser ke titik kosong terdekat (`clearHotspots()`/`placeSafe()` seperti di ROOM_DAFFA_FINAL.html)
- Avatar gerak hanya di walkableArea; saat carry, objek ikut di atas kepala
- Ganti tema → semua objek relayout ke posisi aman tema baru

---

## 6. PERTAHANKAN SEMUA INTERAKSI YANG SUDAH ADA
(ikuti ROOM_DAFFA_FINAL.html persis)
- Klik lantai = jalan; klik avatar = sapaan (suara anak + mulut gerak); idle hanya kedip; tidak melayang
- Klik jendela = siang/malam (crossfade)
- Klik lemari = sheet kostum (SVG layer, level lock)
- Klik meja = sheet tugas (+ notif glow saat ada tugas)
- Klik rak = sheet riwayat
- Klik kasur = sheet tema
- Klik celengan = popup [Pindahkan / Saldo / Investasi]; investasi → ukuran celengan membesar (target = glow + perayaan)
- Klik pet = popup [Ambil (ikut jalan) / Aksi (guk guk)]
- Klik pill Poin (HUD) = sheet Toko Poin
- Mic echo 🎙️; Audio Howler.js + voice (Daffa pitch 1.8, Dio pitch 2.2)
- HUD safe-area (env safe-area-inset)

---

## 7. ASSET TEMA
- `assets/themes/rocket_day.png` (16:10, sudah tersedia) → upload ke Storage bucket `room-themes`
- `rocket_night.png`: saat ini placeholder (gelap). Ganti dengan versi malam asli (komposisi SAMA dengan siang agar hotspot identik).
- Gambar tema baru WAJIB: rasio 16:10, semua furniture/hotspot di zona tengah aman (hindari 8% tepi kiri-kanan), versi siang+malam komposisi identik.

---

## URUTAN
1. Refactor container kamar → fullscreen `cover` + `.stage` cover-scale (hilangkan bar hitam)
2. Pindah semua hotspot/objek ke `.stage`, koordinat % dari config
3. Pasang koordinat hotspot tema rocket (poin 2)
4. Pastikan collision + walkable + klik prioritas benar
5. Test di emulator iPad (4:3) & Android (16:10) → tidak ada bar hitam, hotspot pas
6. Test landscape lock

Auto-run: file edit, build. Jangan ubah backend/DB/logic.

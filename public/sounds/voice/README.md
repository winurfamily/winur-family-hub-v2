# Voice (rekaman suara karakter)

Taruh file MP3 rekaman suara asli di folder `daffa/` dan `dio/` dengan nama
berikut (dipakai untuk urutan sapaan saat avatar di-tap):

- `halo.mp3` — "Halo!"
- `aku.mp3` — "Aku Daffa!" / "Aku Dio!"
- `belajar.mp3` — "Ayo belajar!"
- `bermain.mp3` — "Ayo bermain!"
- `istirahat.mp3` — "Ayo istirahat!"
- `keren.mp3` — "Keren!"

Path lengkap: `public/sounds/voice/daffa/halo.mp3`, `public/sounds/voice/dio/halo.mp3`, dst.

Selama file untuk sebuah baris belum ada, otomatis fallback ke ElevenLabs API
(jika `ELEVENLABS_API_KEY` + `DAFFA_VOICE_ID`/`DIO_VOICE_ID` diisi di
`.env.local`), lalu ke SpeechSynthesis bawaan browser — tidak ada error.

Mic echo (karakter mengulang ucapan anak) selalu lewat fallback di atas, karena
teksnya dinamis dan tidak punya file rekaman.

## Efek pitch saat diputar

Rekaman asli di atas diputar lewat Web Audio + `soundtouchjs` (lihat
`src/lib/audio/pitch-shift.ts`): pitch dinaikkan ~2.5 semitone tanpa mengubah
tempo, supaya terdengar seperti anak kecil tapi tetap natural (bukan efek
chipmunk). Efek ini **hanya saat playback** — file MP3 di folder ini tidak
pernah diubah oleh efek tersebut.

## Rekam ulang dari Admin

Admin → Dunia Anak → Assets → tab "Suara" bisa merekam ulang tiap baris lewat
mic (hanya jalan saat `npm run dev`, lihat `src/app/api/voice/record/route.ts`).
Rekaman di-encode ke MP3 mono di browser lalu **menimpa** file yang sama di
sini — tidak membuat file baru, jadi selalu hanya 1 file aktif per baris.

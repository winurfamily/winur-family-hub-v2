# WINUR FAMILY HUB — V2
Status: READY TO BUILD

---

## Konsep

Family OS berbasis gamifikasi. Anak belajar tanggung jawab, keuangan, dan investasi melalui task harian berhadiah uang nyata.

## Keluarga

```
Family: Winur
├── Ayah   (Admin, PIN)
├── Mamah  (Admin, PIN)
├── Daffa  (Child, 5 tahun)
└── Dio    (Child, 2 tahun)
```

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Motion (Framer Motion) |
| Sound | Howler.js |
| State | Zustand |
| Form | React Hook Form + Zod |
| Backend | Next.js Server Actions |
| Database | Supabase PostgreSQL + Realtime |
| Storage | Supabase Storage |
| AI | OpenAI GPT-4o (task/tugas) + DALL-E 3 (avatar) |
| Deploy | Vercel |

## Struktur Aplikasi

```
Admin masuk → Bottom Nav:
├── Keuangan (finance, pocket, belanja)
└── Dunia Anak (task, tugas, avatar, reward, investasi)

Anak masuk → Tampilan Game (tanpa nav):
└── Halaman utama: avatar, stats, task, tugas, investasi, pilih avatar
```

## Dokumen

```
00_README.md              ← ini
01_PRD.md                 ← fitur lengkap
02_DESIGN_SYSTEM.md       ← visual, animasi, sound
03_DATABASE_ERD.md        ← semua tabel
04_BUILD_PROMPT.md        ← aturan build
05_IMPLEMENTATION_PLAN.md ← sprint
06_DECISION_LOG.md        ← keputusan terkunci
CLAUDE_CODE_PROMPT.md     ← prompt untuk VS Code
```

# 02_DESIGN_SYSTEM.md
Project: Winur Family Hub V2
Status: LOCKED

---

## Style: Sky Adventure

Cerah, playful, game feel untuk anak-anak.
Siang hari yang menyenangkan — langit biru, matahari, petualangan.
Bukan gelap seperti referensi, tapi tetap punya depth dan game feel.

---

## Color Tokens

### Light/Day Mode (Default)
```css
/* Background */
--bg-main:        #E8F4FD   /* Biru langit muda */
--bg-grad-top:    #B8DFF5   /* Langit lebih dalam */
--bg-grad-bottom: #E8F4FD

/* Primary */
--primary:        #FF6B35   /* Oranye petualangan */
--primary-dark:   #E8561F
--primary-light:  #FFF0EA

/* Secondary */
--secondary:      #4CAF50   /* Hijau segar */
--secondary-dark: #388E3C
--secondary-light:#E8F5E9

/* Accent */
--accent:         #7C3AED   /* Ungu magic */
--accent-dark:    #6D28D9
--accent-light:   #EDE9FE

/* Functional */
--yellow:         #FFD93D   /* XP, bintang, koin */
--yellow-dark:    #F4C00A
--pink:           #FF6B9D   /* Mamah, heart */
--pink-dark:      #E8558A
--blue:           #2196F3   /* Info, link */
--blue-dark:      #1976D2
--red:            #F44336   /* Error, danger */
--green:          #4CAF50   /* Success, selesai */

/* Neutral */
--white:          #FFFFFF
--surface:        #FFFFFF
--surface-2:      #F0F8FF
--border:         #C8E6F5
--border-dark:    #90CAF9
--text-1:         #1A2F4A   /* Navy gelap */
--text-2:         #3D5A80   /* Navy medium */
--text-3:         #7A9BB5   /* Biru abu */
--shadow:         rgba(33,150,243,0.15)

/* Cards */
--card-bg:        #FFFFFF
--card-border:    #C8E6F5
--card-shadow:    0 4px 16px rgba(33,150,243,0.12)
```

### Dark Mode (Malam)
```css
--bg-main:    #0F1F35
--surface:    #162B45
--surface-2:  #1E3A5F
--border:     #2A4A6B
--text-1:     #FFFFFF
--text-2:     #B0C4DE
--text-3:     #6B8CAE
```

---

## Typography

| Penggunaan | Font | Weight | Size |
|---|---|---|---|
| Logo/Title | Nunito | 900 | 32px+ |
| Heading | Nunito | 800 | 20-28px |
| Button | Nunito | 700 | 14-16px |
| Body | Plus Jakarta Sans | 500 | 14-16px |
| Caption | Plus Jakarta Sans | 400 | 12px |
| Angka saldo | JetBrains Mono | 700 | 16-24px |

Min font size: 14px (agar tidak auto-zoom di Android)

---

## Komponen Signature

### Button Primary
```css
background: var(--primary);
color: white;
border-radius: 16px;
padding: 14px 28px;
font: Nunito 700 16px;
box-shadow: 0 4px 0 var(--primary-dark);
border: none;
transition: all 0.1s;

:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--primary-dark);
}
```

### Button Green (Approve/Selesai)
```css
background: var(--secondary);
box-shadow: 0 4px 0 var(--secondary-dark);
```

### Card
```css
background: var(--card-bg);
border: 2px solid var(--card-border);
border-radius: 20px;
box-shadow: var(--card-shadow);
padding: 16-20px;
```

### Card Dark (untuk konten di atas bg biru)
```css
background: rgba(255,255,255,0.15);
backdrop-filter: blur(10px);
border: 1px solid rgba(255,255,255,0.3);
border-radius: 20px;
```

### Level Badge
```css
background: linear-gradient(135deg, #FFD93D, #FF6B35);
color: white;
font: Nunito 900;
border-radius: 12px;
padding: 4px 10px;
box-shadow: 0 2px 8px rgba(255,107,53,0.4);
```

### Saldo Pill (Top Bar)
```css
background: rgba(255,107,53,0.15);
border: 2px solid var(--primary);
border-radius: 999px;
padding: 6px 14px;
font: Nunito 800;
color: var(--primary);
```

### Point Pill (Top Bar)
```css
background: rgba(255,217,61,0.15);
border: 2px solid var(--yellow);
border-radius: 999px;
color: var(--yellow-dark);
```

### XP Bar
```css
height: 12px;
border-radius: 999px;
background: rgba(255,255,255,0.2);
fill: linear-gradient(90deg, #4CAF50, #8BC34A);
/* glow saat penuh: box-shadow: 0 0 12px #4CAF50 */
```

### Task Card
```css
background: white;
border-radius: 20px;
border: 2px solid var(--card-border);
box-shadow: var(--card-shadow);
min-width: 160px; /* horizontal scroll */
padding: 12px;
/* gambar AI di atas, judul + reward di bawah */
```

### Avatar Card (Koleksi)
```css
/* Unlock */
border-radius: 16px;
border: 2px solid transparent;
background: white;

/* Active */
border: 3px solid var(--accent);
box-shadow: 0 0 20px rgba(124,58,237,0.4);

/* Locked */
filter: grayscale(100%);
opacity: 0.6;
/* overlay gembok di tengah */
```

### Streak Box
```css
width: 40px; height: 40px;
border-radius: 10px;
border: 2px solid var(--border);
/* Done: background: var(--secondary), border: var(--secondary) */
/* bounce animation saat berubah */
```

### Bottom Nav Child
```css
background: white;
border-top: 2px solid var(--border);
/* Active item: background pill oranye/ungu */
height: 64px;
safe-area-bottom: env(safe-area-inset-bottom);
```

---

## Layout Child (Beranda)

```
┌─────────────────────────────────────────────┐
│ [Avatar mini] Daffa Lv.12 [====XP====]      │  ← Header
│                    [Rp 125K] [⭐250] [🔔3]  │
├─────────────────────────────────────────────┤
│  [Avatar Besar]   Halo, Daffa!              │
│  + Pet            💰 Rp 125.000             │
│                   ⭐ 250 Point              │
│         Progress Hari Ini: ████░ 3/4        │
├─────────────────────────────────────────────┤
│  🔥 Streak Mingguan                         │
│  [M✅][S✅][R✅][K✅][J✅][S✅][Min⭐]      │
│  [Klaim Bonus Rp 15.000 + 15⭐] (Minggu)   │
├─────────────────────────────────────────────┤
│  📋 Task Hari Ini                           │
│  [Task1] [Task2] [Task3] [Tugas]  ←scroll  │
├─────────────────────────────────────────────┤
│  📈 Investasi Aktif                         │
│  Modal Rp100K → Est. Rp110K [====12/30]    │
├─────────────────────────────────────────────┤
│ [🏠] [📈] [👕] [💰] [🎁] [📖]  ← Bottom Nav │
└─────────────────────────────────────────────┘
```

---

## Background Child

Sky Adventure theme (bukan gelap):
```css
background: linear-gradient(160deg,
  #87CEEB 0%,    /* langit biru */
  #B8DFF5 30%,   /* langit muda */
  #E8F4FD 60%,   /* putih langit */
  #C8E8C0 80%,   /* hijau rumput */
  #A8D8A0 100%   /* rumput gelap */
);
```

Elemen dekoratif: awan bergerak pelan, bintang kecil, pohon pojok.

---

## Animasi

| Elemen | Animasi | Durasi |
|---|---|---|
| Avatar idle | Breathing up-down 3px | Loop 3s |
| Pet idle | Bounce + goyang | Loop 2s |
| Page transition | Slide + fade | 250ms |
| Button tap | Scale 0.97 + shadow reduce | 100ms |
| Tap ripple | Circle expand fade | 300ms |
| XP bar fill | Width + glow pulse | 800ms |
| Level up | Full screen confetti | 2500ms |
| Klaim coin | Coin rain particle | 1000ms |
| Streak done | Scale bounce + glow | 400ms |
| Avatar unlock | Scale pop + sparkle | 1500ms |
| Task card appear | Slide up spring | 300ms |
| Card hover/press | Scale 0.98 | 150ms |

---

## Sound (Howler.js — public/sounds/)

| File | Trigger |
|---|---|
| tap.mp3 | Setiap tombol |
| task_done.mp3 | Submit task |
| approved.mp3 | Task approved/klaim |
| level_up.mp3 | Naik level |
| unlock.mp3 | Avatar unlock |
| claim.mp3 | Klaim saldo |
| streak.mp3 | Streak complete |
| invest_done.mp3 | Investasi selesai |
| switch.mp3 | Switch profile |
| pet_idle.mp3 | Pet sound random |

Toggle on/off di Settings. Semua <50KB MP3.

---

## Responsive Rules (App-like Feel)

```css
/* Touch target minimum */
button, a, .tappable { min-height: 48px; min-width: 48px; }

/* Smooth scroll */
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

/* Safe area Android */
.bottom-nav { padding-bottom: env(safe-area-inset-bottom); }
.top-bar { padding-top: env(safe-area-inset-top); }

/* No hover on touch */
@media (hover: none) { button:hover { /* no style */ } }

/* Font agar tidak auto-zoom */
input, select { font-size: 16px; }
```

Breakpoints:
- Mobile: < 768px
- Tablet (primary): 768-1024px
- Desktop: > 1024px

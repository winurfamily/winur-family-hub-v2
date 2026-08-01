# Tempel Daftar Belanja — format teks

Fitur **Belanja → buka rencana → Tempel Daftar** membaca daftar belanja yang
disalin dari WhatsApp, Notes, atau diketik langsung. Pengurainya ada di
[`src/lib/shopping-parser.ts`](../src/lib/shopping-parser.ts) dan dipakai juga
oleh kolom "tambah barang" di checklist.

## Format utama

```
Nama barang ; jumlah ; satuan
```

Contoh:

```
Beras ; 5 ; kg
Minyak Goreng ; 2 ; liter
Telur ; 1 ; kg
```

- Pemisah **kolom** adalah titik koma `;`.
- Pemisah **antar barang** adalah baris baru atau koma.
- Kolom keempat, bila diisi, dibaca sebagai **harga satuan**:
  `Beras ; 5 ; kg ; 12000`.
- Kolom boleh dipotong: `Beras ; 5` dan `Beras` sama-sama sah.

## Format bebas

Cara menulis seperti di WhatsApp tetap didukung dan boleh bercampur dengan
format di atas dalam satu tempelan:

```
Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi
```

Jumlah dan satuan dibaca otomatis; bentuk `2x Susu`, `Telur 3`, `@12.000`, dan
`Rp12.000` ikut dikenali.

## Aturan pembacaan

| Aturan | Perilaku |
| --- | --- |
| Spasi berlebih | Dibuang (`  Beras   5   kg ` → `Beras`, 5, `kg`). |
| Potongan kosong | Diabaikan, tidak menggagalkan tempelan. |
| Jumlah tidak disebut | Menjadi 1, tidak pernah 0. |
| Satuan tidak disebut | Dibiarkan kosong — tidak dikarang menjadi `pcs`. |
| Koma di antara angka | Bagian dari bilangan (`1,5 kg`, `Rp 18,500`), bukan pemisah barang. |
| Titik koma yang jelas memisahkan barang | Tetap terbaca sebagai pemisah barang (`Beras 5 kg; Gula 1 kg`). |
| Barang kembar dalam satu tempelan | Digabung, jumlahnya dijumlahkan. |
| Barang yang sudah ada di checklist | Ditandai dan otomatis dilewati. |
| Batas | 100 barang per tempelan. |

## Pratinjau wajib

Hasil pembacaan **selalu** melewati layar pratinjau: nama, jumlah, satuan, dan
harga bisa diperbaiki, dan tiap baris bisa dibuang sebelum disimpan. Tidak ada
teks yang langsung masuk ke checklist tanpa dilihat dulu.

## Uji

- Unit: [`tests/shopping-parser.test.ts`](../tests/shopping-parser.test.ts)
- Integrasi (Supabase sungguhan):
  [`tests/belanja-flow.integration.test.ts`](../tests/belanja-flow.integration.test.ts)

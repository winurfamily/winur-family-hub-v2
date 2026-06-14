-- Tambah kolom category pada tasks, agar generate AI bisa diarahkan
-- berdasarkan kategori (bukan random) dan UI bisa menampilkan ilustrasi
-- default sesuai kategori saat tidak memakai gambar AI.

alter table tasks add column if not exists category text;

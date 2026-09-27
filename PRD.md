# PRD — WA Expense Bot

## 1. Latar Belakang & Tujuan
Membuat bot WhatsApp pribadi untuk mencatat pengeluaran harian secara cepat lewat chat, tanpa perlu buka aplikasi terpisah. Tujuan utama:
- Mencatat transaksi hanya dengan mengirim pesan (mis. `keluar 25000 makan siang`).
- Melihat ringkasan pengeluaran (harian/mingguan/bulanan) langsung dari chat.
- Mencatat otomatis pengeluaran rutin bulanan (langganan, cicilan, sewa) tanpa input ulang tiap bulan.
- Mendapat saran/insight keuangan dari AI.
- Berjalan di infrastruktur serverless (Vercel) agar mudah di-deploy dan minim maintenance server.

## 2. Target Pengguna
💡 Personal use (single-user) — Christian sendiri. Struktur data dibuat agar mudah dikembangkan ke multi-user nanti kalau dibutuhkan.

## 3. User Stories
| # | Sebagai pengguna, saya ingin... | Agar... |
|---|---|---|
| 1 | mengirim pesan singkat untuk mencatat pengeluaran | tidak perlu buka app lain |
| 2 | mendapat konfirmasi otomatis setelah mencatat | yakin transaksi tersimpan |
| 3 | melihat total pengeluaran hari ini/minggu ini/bulan ini | tahu kondisi keuangan real-time |
| 4 | mengelompokkan pengeluaran per kategori (makan, transport, dll) | tahu ke mana uang habis |
| 5 | mengedit/menghapus transaksi terakhir jika salah input | data tetap akurat |
| 6 | mendapat reminder jika belum mencatat di hari itu | konsisten mencatat |
| 7 | mengekspor data ke Excel/CSV | analisis lebih lanjut atau backup |
| 8 | input pengeluaran bulanan (langganan, cicilan, sewa) sekali saja | tidak perlu catat manual tiap bulan, otomatis kepotong dari ringkasan |
| 9 | mendapat saran hemat dari AI berdasarkan pola pengeluaran saya | bisa lebih baik kelola uang |

## 4. Fitur Utama (Scope MVP)
1. **Catat pengeluaran** via free-text: `keluar <jumlah> <keterangan> [#kategori]`
2. **Catat pemasukan** (opsional): `masuk <jumlah> <keterangan>`
3. **Parsing otomatis kategori** dari kata kunci (mis. "makan" → Food, "bensin" → Transport) dengan fallback ke kategori "Lainnya"
4. **Ringkasan on-demand**: `ringkasan hari`, `ringkasan minggu`, `ringkasan bulan`
5. **Koreksi transaksi**: `hapus terakhir`, `edit terakhir <jumlah baru>`
6. **Reminder harian** (opsional, via Vercel Cron) jika belum ada transaksi tercatat
7. **Menu interaktif**: kirim `menu` → bot balas daftar perintah dalam bentuk list/button WhatsApp, user tinggal tap opsi yang diinginkan
8. **AI Advisor (Gemini)**: kirim `saran` atau `analisa` → bot kirim ringkasan pengeluaran ke Gemini API (free tier), balas dengan insight/saran hemat dalam bahasa natural
9. **Pengeluaran rutin bulanan (recurring expense)**: input sekali, lalu bot otomatis mencatat sebagai pengeluaran setiap bulan di tanggal yang ditentukan
   - `tambah rutin <jumlah> <nama> tgl <tanggal>` → mis. `tambah rutin 150000 netflix tgl 5`
   - `list rutin` → tampilkan semua pengeluaran rutin aktif
   - `hapus rutin <nama>` / `nonaktif rutin <nama>` → berhenti auto-catat

💡 Fitur di luar MVP (v2+): budgeting/limit per kategori, grafik visual, multi-user, integrasi rekening bank/e-wallet.

## 5. Alur Utama (Flow)
```
User kirim pesan WA
        │
        ▼
Webhook (Vercel API route) menerima pesan dari WhatsApp Cloud API
        │
        ▼
Parser intent (catat / ringkasan / edit / menu / saran / rutin)
        │
        ├─▶ [Intent: catat] ─▶ Ekstrak jumlah/kategori ─▶ Simpan ke Google Sheet ─▶ Balas konfirmasi
        │
        ├─▶ [Intent: ringkasan] ─▶ Ambil & agregat data dari Sheet ─▶ Balas ringkasan teks
        │
        ├─▶ [Intent: menu] ─▶ Balas list/button interaktif WA
        │
        └─▶ [Intent: saran/analisa] ─▶ Ambil data transaksi periode terkait
                    │
                    ▼
            Kirim prompt + data ke Gemini API (free tier)
                    │
                    ▼
            Balas insight/saran dari Gemini ke WA
```

**Alur terpisah — Vercel Cron pengeluaran rutin bulanan (tidak dipicu chat, jalan otomatis):**
```
Vercel Cron memanggil endpoint /api/cron/recurring sekali sehari (jam 00:00)
        │
        ▼
Ambil semua baris di sheet `recurring_expenses` yang aktif
        │
        ▼
Cocokkan: apakah hari ini == tanggal jatuh tempo?
        │
        ▼ (jika cocok, dan belum dieksekusi hari ini)
Tambahkan baris baru ke sheet `transactions` (type=expense, sumber=recurring)
        │
        ▼
Kirim notifikasi ke WA via WhatsApp Cloud API: "Pengeluaran rutin 'Netflix' Rp150.000 sudah tercatat otomatis"
```

## 6. Kebutuhan Non-Fungsional
- **Latency balasan**: idealnya < 3 detik untuk parsing sederhana; perhatikan batas timeout function Vercel (10 detik di plan Hobby, 60 detik di plan Pro).
- **Reliability**: tidak boleh kehilangan transaksi meski parsing gagal (fallback: simpan sebagai "unparsed" + minta klarifikasi).
- **Keamanan**: token WhatsApp Cloud API, kredensial Google Service Account, dan Gemini API key disimpan sebagai Environment Variables di Vercel, bukan hardcoded atau di-commit ke repo.
- **Biaya**: 💡 WhatsApp Cloud API punya kuota gratis conversation per bulan (jumlah pasti bisa berubah, cek [developers.facebook.com/docs/whatsapp/pricing](https://developers.facebook.com/docs/whatsapp/pricing) untuk angka terbaru) — untuk pemakaian personal (kirim pesan ke 1 nomor sendiri) biasanya masih dalam batas gratis. Google Sheets, Vercel Hobby plan, dan Gemini free tier juga gratis dengan batas rate limit masing-masing.

## 7. Metrik Sukses
- Bot berhasil mencatat >95% pesan dengan format yang diikuti tanpa error.
- Pengeluaran rutin bulanan tercatat otomatis tanpa duplikasi maupun terlewat.
- Waktu setup awal < 1–2 hari (termasuk verifikasi WhatsApp Business, lebih lama dari setup Baileys karena ada proses approval Meta).

---
💡 **Catatan penting**: karena beralih dari Baileys (gratis, tanpa approval) ke WhatsApp Cloud API resmi (perlu Meta Business App + verifikasi nomor), ada trade-off waktu setup awal yang lebih lama dan kuota gratis bulanan yang terbatas — sebagai gantinya, arsitektur ini kompatibel penuh dengan Vercel dan tidak perlu server yang menyala terus.

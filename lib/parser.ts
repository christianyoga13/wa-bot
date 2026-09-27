import { ParsedIntent } from '@/types';

// Default keyword-to-category mapping
export const DEFAULT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    'makan', 'kopi', 'coffee', 'cafe', 'kafe', 'jajan', 'lunch', 'dinner', 'sarapan',
    'gofood', 'grabfood', 'shopeefood', 'resto', 'restoran', 'beras', 'cemilan',
    'snack', 'minum', 'bakso', 'mie', 'nasi', 'ayam', 'warteg'
  ],
  Transport: [
    'bensin', 'ojek', 'tol', 'grab', 'gojek', 'parkir', 'krl', 'mrt', 'busway',
    'tiket', 'pertamax', 'pertalite', 'solar', 'angkot', 'taksi', 'kereta'
  ],
  Shopping: [
    'belanja', 'baju', 'shopee', 'tokped', 'tokopedia', 'celana', 'sepatu',
    'beli', 'lazada', 'blibli', 'minimarket', 'indomaret', 'alfamart', 'supermarket'
  ],
  Bills: [
    'listrik', 'pln', 'pdam', 'air', 'wifi', 'indihome', 'biznet', 'telkom',
    'pulsa', 'kuota', 'pbb', 'bpjs', 'iuran', 'tagihan', 'sewa', 'kontrakan', 'kost'
  ],
  Entertainment: [
    'netflix', 'spotify', 'youtube', 'bioskop', 'nonton', 'game', 'steam',
    'playstation', 'topup', 'konser', 'liburan', 'hotel'
  ],
  Health: [
    'obat', 'apotek', 'dokter', 'rs', 'rumah sakit', 'vitamin', 'klinik',
    'rontgen', 'rapid', 'tes lab'
  ],
  Education: [
    'buku', 'kursus', 'kelas', 'kuliah', 'sekolah', 'udemy', 'seminar', 'webinar'
  ]
};

/**
 * Parse Indonesian number formats like:
 * - 25000, 25.000, 25,000
 * - 25k, 25.5k
 * - 1.5jt, 2jt, 1.5m
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw.trim().toLowerCase();

  // Strip leading currency symbols: "rp", "rp.", "idr"
  cleaned = cleaned.replace(/^(?:rp\.?|idr)\s*/i, '').trim();

  // match "1.5jt", "2jt", "1,5jt", "1.5 juta", "2 jt"
  const jtMatch = cleaned.match(/^([\d.,]+)\s*(?:jt|juta|m)$/);
  if (jtMatch) {
    const rawNum = jtMatch[1].replace(',', '.');
    const val = parseFloat(rawNum);
    return isNaN(val) ? null : Math.round(val * 1_000_000);
  }

  // match "500k", "25.5k", "150rb", "150 ribu", "150 k", "150 rb"
  const kMatch = cleaned.match(/^([\d.,]+)\s*(?:k|rb|ribu)$/);
  if (kMatch) {
    const rawNum = kMatch[1].replace(',', '.');
    const val = parseFloat(rawNum);
    return isNaN(val) ? null : Math.round(val * 1_000);
  }

  // match standard digits with dot or comma as thousand separator
  // e.g. "25.000", "25,000", "25000"
  let numStr = cleaned.replace(/[^\d.,]/g, '');
  if (numStr.includes('.') && !numStr.includes(',')) {
    numStr = numStr.replace(/\./g, '');
  } else if (numStr.includes(',') && !numStr.includes('.')) {
    numStr = numStr.replace(/,/g, '');
  } else if (numStr.includes('.') && numStr.includes(',')) {
    numStr = numStr.split(',')[0].replace(/\./g, '');
  }

  const result = parseInt(numStr, 10);
  return isNaN(result) || result <= 0 ? null : result;
}

/**
 * Detect category from text and optional custom keywords mapping
 */
export function detectCategory(
  text: string,
  explicitCategory?: string,
  customKeywords?: Record<string, string[]>
): string {
  if (explicitCategory) {
    return capitalize(explicitCategory);
  }

  const keywordMap = customKeywords || DEFAULT_CATEGORY_KEYWORDS;
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(keywordMap)) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
      if (regex.test(lowerText) || lowerText.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }

  return 'Lainnya';
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Main intent parser
 */
export function parseMessage(
  rawText: string,
  customCategoryMap?: Record<string, string[]>
): ParsedIntent {
  const trimmed = (rawText || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Menu / Bantuan / Help
  if (
    lower === 'menu' ||
    lower === 'bantuan' ||
    lower === 'help' ||
    lower === 'halo' ||
    lower === 'hi' ||
    lower === 'start'
  ) {
    return {
      intent: 'MENU',
      rawMessage: trimmed
    };
  }

  // 2. AI Advisor / Saran / Analisa
  if (
    lower === 'saran' ||
    lower === 'analisa' ||
    lower === 'analisis' ||
    lower === 'insight' ||
    lower.startsWith('saran ') ||
    lower.startsWith('analisa ')
  ) {
    return {
      intent: 'AI_ADVICE',
      rawMessage: trimmed
    };
  }

  // 3. Ringkasan / Laporan
  // ringkasan hari / ringkasan minggu / ringkasan bulan / ringkasan
  const summaryMatch = lower.match(/^(?:ringkasan|laporan|rekap|summary)(?:\s+(hari|minggu|bulan|today|week|month))?$/);
  if (summaryMatch) {
    const p = summaryMatch[1];
    let period: 'day' | 'week' | 'month' = 'month';
    if (p === 'hari' || p === 'today') period = 'day';
    else if (p === 'minggu' || p === 'week') period = 'week';
    else if (p === 'bulan' || p === 'month') period = 'month';

    const intentMap: Record<string, 'SUMMARY_DAY' | 'SUMMARY_WEEK' | 'SUMMARY_MONTH'> = {
      day: 'SUMMARY_DAY',
      week: 'SUMMARY_WEEK',
      month: 'SUMMARY_MONTH'
    };

    return {
      intent: intentMap[period],
      period,
      rawMessage: trimmed
    };
  }

  // 4. Hapus Terakhir / Undo
  if (
    lower === 'hapus terakhir' ||
    lower === 'batal terakhir' ||
    lower === 'undo' ||
    lower === 'cancel'
  ) {
    return {
      intent: 'DELETE_LAST',
      rawMessage: trimmed
    };
  }

  // 5. Edit Terakhir <jumlah baru>
  // edit terakhir 30000 / edit terakhir 30k
  const editMatch = trimmed.match(/^(?:edit\s+terakhir|koreksi\s+terakhir)\s+([0-9.,kKjJtTaA]+)$/i);
  if (editMatch) {
    const amount = parseAmount(editMatch[1]);
    if (amount) {
      return {
        intent: 'EDIT_LAST',
        amount,
        rawMessage: trimmed
      };
    }
  }

  // 6. Pengeluaran Rutin: List Rutin
  if (
    lower === 'list rutin' ||
    lower === 'daftar rutin' ||
    lower === 'rutin list' ||
    lower === 'cek rutin'
  ) {
    return {
      intent: 'LIST_RECURRING',
      rawMessage: trimmed
    };
  }

  // 7. Pengeluaran Rutin: Hapus / Nonaktif Rutin
  // hapus rutin netflix / nonaktif rutin spotify
  const delRecurringMatch = trimmed.match(/^(?:hapus\s+rutin|nonaktif\s+rutin|batal\s+rutin)\s+(.+)$/i);
  if (delRecurringMatch) {
    const name = delRecurringMatch[1].trim();
    return {
      intent: 'DELETE_RECURRING',
      name,
      rawMessage: trimmed
    };
  }

  // 8. Pengeluaran Rutin: Panduan / Bantuan
  if (
    lower === 'tambah rutin' ||
    lower === 'rutin' ||
    lower === 'pengeluaran rutin' ||
    lower === 'cara tambah rutin' ||
    lower === 'bantuan rutin'
  ) {
    return {
      intent: 'HELP_RECURRING',
      rawMessage: trimmed
    };
  }

  // 9. Pengeluaran Rutin: Tambah Rutin (Fleksibel)
  // Contoh:
  // - tambah rutin 150000 netflix tgl 5
  // - tambah rutin 150k spotify tanggal 20
  // - tambah rutin netflix 150rb tgl 5
  // - tambah rutin netflix 150k tiap tgl 5
  // - tambah rutin netflix 150k setiap tgl 5
  // - tambah rutin netflix 150k tiap bulan tgl 5
  // - tambah rutin 150k netflix tgl 5 tiap bulan
  // - rutin netflix 150k tgl 5
  const recurringPrefixMatch = trimmed.match(
    /^(?:tambah\s+(?:pengeluaran\s+)?rutin|rutin\s+tambah|pengeluaran\s+rutin|rutin)\s+(.+)$/i
  );
  if (recurringPrefixMatch) {
    let body = recurringPrefixMatch[1].trim();

    // Extract hashtag category if any
    const hashtagMatch = body.match(/#(\w+)/);
    const hashtagCat = hashtagMatch ? hashtagMatch[1] : undefined;
    body = body.replace(/#\w+/g, '').trim();

    // Strip recurrent frequency words: "tiap bulan", "setiap bulan", "per bulan", "perbulan"
    body = body.replace(/\b(?:tiap|setiap|per)\s*bulan\b/gi, '').trim();
    body = body.replace(/\bperbulan\b/gi, '').trim();

    // Extract due date: "tgl 5", "tanggal 20", "tiap tgl 5", "setiap tanggal 10"
    const dateMatch = body.match(/(?:\b(?:tiap|setiap)\s+)?(?:tgl|tanggal)\s*(\d{1,2})\b/i);
    if (dateMatch) {
      const dueDate = parseInt(dateMatch[1], 10);
      if (dueDate >= 1 && dueDate <= 31) {
        body = body.replace(dateMatch[0], '').trim();

        // Extract amount token
        const amountRegex = /(?:rp\.?\s*)?(?:\d+(?:[.,]\d+)?\s*(?:jt|juta|m|k|rb|ribu)|\d{1,3}(?:[.,]\d{3})+|\d+)/i;
        const matchAmount = body.match(amountRegex);
        if (matchAmount) {
          const amount = parseAmount(matchAmount[0]);
          const name = body.replace(matchAmount[0], '').replace(/\s+/g, ' ').trim();
          if (amount && name) {
            const category = detectCategory(name, hashtagCat, customCategoryMap);
            return {
              intent: 'ADD_RECURRING',
              amount,
              name,
              dueDate,
              category,
              rawMessage: trimmed
            };
          }
        }
      }
    }
  }

  // 10. Catat Pemasukan
  // masuk 5000000 gaji bulanan
  // masuk 500k bonus
  // masuk 150rb freelance
  const incomeMatch = trimmed.match(
    /^(?:masuk|income|in|m)\s+(?:rp\.?\s*)?([0-9.,]+(?:\s*(?:k|rb|ribu|jt|juta|m))?)(?:\s+(.*))?$/i
  );
  if (incomeMatch) {
    const amount = parseAmount(incomeMatch[1]);
    const rest = (incomeMatch[2] || '').trim();
    if (amount) {
      const hashtagMatch = rest.match(/#(\w+)/);
      const hashtagCategory = hashtagMatch ? hashtagMatch[1] : undefined;
      const cleanNote = rest.replace(/#\w+/, '').trim() || 'Pemasukan';
      const category = detectCategory(cleanNote, hashtagCategory || 'Income', customCategoryMap);

      return {
        intent: 'RECORD_INCOME',
        amount,
        note: cleanNote,
        category,
        rawMessage: trimmed
      };
    }
  }

  // 11. Catat Pengeluaran
  // keluar 25000 makan siang [#food]
  // k 25k kopi susu
  // keluar 150rb belanja
  const expensePrefixMatch = trimmed.match(
    /^(?:keluar|expense|out|k)\s+(?:rp\.?\s*)?([0-9.,]+(?:\s*(?:k|rb|ribu|jt|juta|m))?)(?:\s+(.*))?$/i
  );
  if (expensePrefixMatch) {
    const amount = parseAmount(expensePrefixMatch[1]);
    const rest = (expensePrefixMatch[2] || '').trim();
    if (amount) {
      const hashtagMatch = rest.match(/#(\w+)/);
      const hashtagCategory = hashtagMatch ? hashtagMatch[1] : undefined;
      const cleanNote = rest.replace(/#\w+/, '').trim() || 'Pengeluaran';
      const category = detectCategory(cleanNote, hashtagCategory, customCategoryMap);

      return {
        intent: 'RECORD_EXPENSE',
        amount,
        note: cleanNote,
        category,
        rawMessage: trimmed
      };
    }
  }

  // 12. Shortcut Format: "<amount> <note>" (e.g. "25000 kopi", "25k makan siang", "150rb baju")
  const shortcutMatch = trimmed.match(
    /^(?:rp\.?\s*)?([0-9.,]+(?:\s*(?:k|rb|ribu|jt|juta|m))?)\s+(.+)$/i
  );
  if (shortcutMatch) {
    const amount = parseAmount(shortcutMatch[1]);
    const rest = shortcutMatch[2].trim();
    if (amount && rest && isNaN(Number(rest))) {
      const hashtagMatch = rest.match(/#(\w+)/);
      const hashtagCategory = hashtagMatch ? hashtagMatch[1] : undefined;
      const cleanNote = rest.replace(/#\w+/, '').trim();
      const category = detectCategory(cleanNote, hashtagCategory, customCategoryMap);

      return {
        intent: 'RECORD_EXPENSE',
        amount,
        note: cleanNote,
        category,
        rawMessage: trimmed
      };
    }
  }

  // 13. Fallback / Unknown
  return {
    intent: 'UNKNOWN',
    rawMessage: trimmed
  };
}

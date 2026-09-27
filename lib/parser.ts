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
  const cleaned = raw.trim().toLowerCase();

  // match "1.5jt" or "2jt" or "1,5jt"
  const jtMatch = cleaned.match(/^([\d.,]+)\s*(?:jt|juta|m)$/);
  if (jtMatch) {
    const rawNum = jtMatch[1].replace(',', '.');
    const val = parseFloat(rawNum);
    return isNaN(val) ? null : Math.round(val * 1_000_000);
  }

  // match "500k" or "25.5k" or "25,5k"
  const kMatch = cleaned.match(/^([\d.,]+)\s*k$/);
  if (kMatch) {
    const rawNum = kMatch[1].replace(',', '.');
    const val = parseFloat(rawNum);
    return isNaN(val) ? null : Math.round(val * 1_000);
  }

  // match standard digits with dot or comma as thousand separator
  // e.g. "25.000", "25,000", "25000"
  // remove dots and commas if followed by 3 digits
  let numStr = cleaned.replace(/[^\d.,]/g, '');
  if (numStr.includes('.') && !numStr.includes(',')) {
    // If it looks like 25.000, remove dots
    const parts = numStr.split('.');
    if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
      numStr = numStr.replace(/\./g, '');
    } else {
      numStr = numStr.replace(/\./g, '');
    }
  } else if (numStr.includes(',') && !numStr.includes('.')) {
    const parts = numStr.split(',');
    if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
      numStr = numStr.replace(/,/g, '');
    } else {
      numStr = numStr.replace(/,/g, '');
    }
  } else if (numStr.includes('.') && numStr.includes(',')) {
    // e.g. 1.000.000,00 -> remove dots, discard decimal
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

  // 6. Pengeluaran Rutin: Tambah Rutin
  // tambah rutin 150000 netflix tgl 5
  // tambah rutin 150k spotify tanggal 20
  const addRecurringMatch = trimmed.match(
    /^(?:tambah\s+rutin|rutin\s+tambah)\s+([0-9.,kKjJtTaA]+)\s+(.+?)\s+(?:tgl|tanggal)\s+(\d{1,2})(?:\s+#(\w+))?$/i
  );
  if (addRecurringMatch) {
    const amount = parseAmount(addRecurringMatch[1]);
    const name = addRecurringMatch[2].trim();
    const dueDate = parseInt(addRecurringMatch[3], 10);
    const hashtagCat = addRecurringMatch[4];

    if (amount && name && dueDate >= 1 && dueDate <= 31) {
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

  // 7. Pengeluaran Rutin: List Rutin
  if (
    lower === 'list rutin' ||
    lower === 'daftar rutin' ||
    lower === 'rutin list'
  ) {
    return {
      intent: 'LIST_RECURRING',
      rawMessage: trimmed
    };
  }

  // 8. Pengeluaran Rutin: Hapus / Nonaktif Rutin
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

  // 9. Catat Pemasukan
  // masuk 5000000 gaji bulanan
  // masuk 500k bonus
  const incomeMatch = trimmed.match(/^(?:masuk|income|in|m)\s+([0-9.,kKjJtTaA]+)(?:\s+(.*))?$/i);
  if (incomeMatch) {
    const amount = parseAmount(incomeMatch[1]);
    const rest = (incomeMatch[2] || '').trim();
    if (amount) {
      // Check for hashtag category
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

  // 10. Catat Pengeluaran
  // keluar 25000 makan siang [#food]
  // k 25k kopi susu
  const expensePrefixMatch = trimmed.match(/^(?:keluar|expense|out|k)\s+([0-9.,kKjJtTaA]+)(?:\s+(.*))?$/i);
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

  // 11. Shortcut Format: "<amount> <note>" (e.g. "25000 kopi", "25k makan siang")
  const shortcutMatch = trimmed.match(/^([0-9.,]+[kKjJtTaA]?)\s+(.+)$/);
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

  // 12. Fallback / Unknown
  return {
    intent: 'UNKNOWN',
    rawMessage: trimmed
  };
}

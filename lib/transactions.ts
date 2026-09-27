import crypto from 'crypto';
import {
  Transaction,
  RecurringExpense,
  ParsedIntent,
  ExecutionResult
} from '@/types';
import { parseMessage } from './parser';
import {
  appendTransaction,
  getAllTransactions,
  deleteLatestTransaction,
  editLatestTransactionAmount,
  getRecurringExpenses,
  addRecurringExpense,
  toggleRecurringExpense,
  getCategoryMappings
} from './sheets';
import { generateFinancialAdvice } from './ai-advisor';

/**
 * Format number to Indonesian Rupiah currency string
 */
export function formatRp(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/**
 * Format ISO date string to readable Indonesian date
 */
export function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  } catch {
    return isoStr;
  }
}

/**
 * Main coordinator to handle incoming user chat message
 */
export async function handleUserMessage(
  rawText: string,
  _senderPhone?: string
): Promise<ExecutionResult> {
  const categoryMap = await getCategoryMappings();
  const parsed: ParsedIntent = parseMessage(rawText, categoryMap);

  switch (parsed.intent) {
    case 'RECORD_EXPENSE':
      return await handleRecordExpense(parsed);

    case 'RECORD_INCOME':
      return await handleRecordIncome(parsed);

    case 'SUMMARY_DAY':
    case 'SUMMARY_WEEK':
    case 'SUMMARY_MONTH':
      return await handleSummary(parsed.period || 'month');

    case 'DELETE_LAST':
      return await handleDeleteLast();

    case 'EDIT_LAST':
      return await handleEditLast(parsed.amount || 0);

    case 'MENU':
      return handleMenu();

    case 'AI_ADVICE':
      return await handleAiAdvice();

    case 'ADD_RECURRING':
      return await handleAddRecurring(parsed);

    case 'LIST_RECURRING':
      return await handleListRecurring();

    case 'DELETE_RECURRING':
      return await handleDeleteRecurring(parsed.name || '');

    case 'HELP':
    case 'UNKNOWN':
    default:
      return handleHelp(rawText);
  }
}

/**
 * Handle expense recording
 */
async function handleRecordExpense(parsed: ParsedIntent): Promise<ExecutionResult> {
  if (!parsed.amount) {
    return {
      success: false,
      replyText: '⚠️ Jumlah pengeluaran tidak valid. Contoh: `keluar 25000 makan siang`'
    };
  }

  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: parsed.amount,
    category: parsed.category || 'Lainnya',
    note: parsed.note || 'Pengeluaran',
    raw_message: parsed.rawMessage,
    source: 'manual',
    created_at: new Date().toISOString()
  };

  await appendTransaction(tx);

  const replyText =
    `✅ *Pengeluaran Dicatat!*\n\n` +
    `💰 *Jumlah:* ${formatRp(tx.amount)}\n` +
    `🏷️ *Kategori:* ${tx.category}\n` +
    `📝 *Catatan:* ${tx.note}\n` +
    `📅 *Waktu:* ${formatDate(tx.created_at)}`;

  return { success: true, replyText };
}

/**
 * Handle income recording
 */
async function handleRecordIncome(parsed: ParsedIntent): Promise<ExecutionResult> {
  if (!parsed.amount) {
    return {
      success: false,
      replyText: '⚠️ Jumlah pemasukan tidak valid. Contoh: `masuk 5000000 gaji bulanan`'
    };
  }

  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: 'income',
    amount: parsed.amount,
    category: parsed.category || 'Income',
    note: parsed.note || 'Pemasukan',
    raw_message: parsed.rawMessage,
    source: 'manual',
    created_at: new Date().toISOString()
  };

  await appendTransaction(tx);

  const replyText =
    `✅ *Pemasukan Dicatat!*\n\n` +
    `💵 *Jumlah:* ${formatRp(tx.amount)}\n` +
    `🏷️ *Kategori:* ${tx.category}\n` +
    `📝 *Catatan:* ${tx.note}\n` +
    `📅 *Waktu:* ${formatDate(tx.created_at)}`;

  return { success: true, replyText };
}

/**
 * Handle summary reports (day, week, month)
 */
async function handleSummary(period: 'day' | 'week' | 'month'): Promise<ExecutionResult> {
  const transactions = await getAllTransactions();
  const now = new Date();

  let startDate: Date;
  let titlePeriod = '';

  if (period === 'day') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    titlePeriod = `Hari Ini (${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`;
  } else if (period === 'week') {
    // Start of week (Monday)
    const day = now.getDay() || 7;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
    titlePeriod = `Minggu Ini (${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`;
  } else {
    // Month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    titlePeriod = `Bulan Ini (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
  }

  const filtered = transactions.filter(t => {
    try {
      const txDate = new Date(t.created_at);
      return txDate >= startDate && txDate <= now;
    } catch {
      return false;
    }
  });

  const expenses = filtered.filter(t => t.type === 'expense');
  const incomes = filtered.filter(t => t.type === 'income');

  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;

  // Breakdown by category
  const categoryTotals: Record<string, number> = {};
  for (const t of expenses) {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  }

  const categoryLines = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
      return `• *${cat}:* ${formatRp(amt)} (${pct}%)`;
    })
    .join('\n');

  // Top 3 recent transactions
  const recentLines = filtered
    .slice(-3)
    .reverse()
    .map(t => `• ${t.type === 'expense' ? '🔴' : '🟢'} ${formatRp(t.amount)} — ${t.note || t.category}`)
    .join('\n');

  let replyText =
    `📊 *Ringkasan Pengeluaran ${titlePeriod}*\n\n` +
    `🔴 Total Pengeluaran: *${formatRp(totalExpense)}*\n` +
    `🟢 Total Pemasukan: *${formatRp(totalIncome)}*\n` +
    `📈 Tabungan Bersih: *${formatRp(netSavings)}*\n` +
    `📝 Total Transaksi: *${filtered.length}*\n\n`;

  if (categoryLines) {
    replyText += `*Rincian Per Kategori:*\n${categoryLines}\n\n`;
  }

  if (recentLines) {
    replyText += `*Transaksi Terkini:*\n${recentLines}`;
  } else {
    replyText += `_Belum ada transaksi di periode ini._`;
  }

  return { success: true, replyText };
}

/**
 * Handle delete last transaction
 */
async function handleDeleteLast(): Promise<ExecutionResult> {
  const deleted = await deleteLatestTransaction();
  if (!deleted) {
    return {
      success: false,
      replyText: '⚠️ Tidak ada transaksi terakhir yang dapat dihapus.'
    };
  }

  const replyText =
    `🗑️ *Transaksi Terakhir Dibatalkan*\n\n` +
    `• Jenis: ${deleted.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}\n` +
    `• Jumlah: ${formatRp(deleted.amount)}\n` +
    `• Keterangan: ${deleted.note || deleted.category}\n` +
    `• Kategori: ${deleted.category}\n\n` +
    `_Data telah dihapus dari Google Sheets._`;

  return { success: true, replyText };
}

/**
 * Handle edit last transaction amount
 */
async function handleEditLast(newAmount: number): Promise<ExecutionResult> {
  if (newAmount <= 0) {
    return {
      success: false,
      replyText: '⚠️ Format salah. Contoh: `edit terakhir 30000`'
    };
  }

  const result = await editLatestTransactionAmount(newAmount);
  if (!result) {
    return {
      success: false,
      replyText: '⚠️ Tidak ada transaksi terakhir yang dapat diubah.'
    };
  }

  const replyText =
    `✏️ *Transaksi Terakhir Diperbarui!*\n\n` +
    `• Keterangan: ${result.updated.note || result.updated.category}\n` +
    `• Jumlah Sebelumnya: ${formatRp(result.previous.amount)}\n` +
    `• Jumlah Baru: *${formatRp(result.updated.amount)}* 🎯\n\n` +
    `_Perubahan telah disimpan ke Google Sheets._`;

  return { success: true, replyText };
}

/**
 * Handle interactive menu
 */
function handleMenu(): ExecutionResult {
  const headerText = '🤖 Expense Bot Menu';
  const bodyText =
    `Pilih perintah cepat atau ketik langsung di chat:\n\n` +
    `*Catat Transaksi:*\n` +
    `• \`keluar 25000 kopi susu\`\n` +
    `• \`masuk 5000000 gaji\`\n\n` +
    `*Laporan:*\n` +
    `• \`ringkasan hari\`\n` +
    `• \`ringkasan minggu\`\n` +
    `• \`ringkasan bulan\`\n\n` +
    `*Koreksi:*\n` +
    `• \`hapus terakhir\`\n` +
    `• \`edit terakhir <jumlah>\`\n\n` +
    `*AI & Rutin:*\n` +
    `• \`saran\` (AI Advisor)\n` +
    `• \`list rutin\` / \`tambah rutin\``;

  const sections = [
    {
      title: '📊 Ringkasan Keuangan',
      rows: [
        { id: 'ringkasan hari', title: 'Ringkasan Hari Ini', description: 'Lihat pengeluaran hari ini' },
        { id: 'ringkasan minggu', title: 'Ringkasan Minggu Ini', description: 'Lihat pengeluaran 7 hari ini' },
        { id: 'ringkasan bulan', title: 'Ringkasan Bulan Ini', description: 'Lihat rekapitulasi bulanan' },
      ]
    },
    {
      title: '🤖 Fitur Pintar',
      rows: [
        { id: 'saran', title: 'Saran AI Finansial', description: 'Dapatkan insight hemat dari Gemini AI' },
        { id: 'list rutin', title: 'Daftar Pengeluaran Rutin', description: 'Lihat tagihan/langganan aktif' }
      ]
    },
    {
      title: '✏️ Koreksi Cepat',
      rows: [
        { id: 'hapus terakhir', title: 'Hapus Terakhir', description: 'Batalkan transaksi paling baru' }
      ]
    }
  ];

  return {
    success: true,
    replyText: `${headerText}\n\n${bodyText}`,
    interactiveType: 'list',
    interactiveData: {
      header: headerText,
      body: bodyText,
      button: 'Lihat Pilihan Menu',
      sections
    }
  };
}

/**
 * Handle AI financial advice
 */
async function handleAiAdvice(): Promise<ExecutionResult> {
  const transactions = await getAllTransactions();
  // Filter last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recent = transactions.filter(t => {
    try {
      return new Date(t.created_at) >= thirtyDaysAgo;
    } catch {
      return true;
    }
  });

  const replyText = await generateFinancialAdvice(recent, '30 Hari Terakhir');
  return { success: true, replyText };
}

/**
 * Handle adding a recurring expense
 */
async function handleAddRecurring(parsed: ParsedIntent): Promise<ExecutionResult> {
  if (!parsed.name || !parsed.amount || !parsed.dueDate) {
    return {
      success: false,
      replyText: '⚠️ Format salah. Contoh: `tambah rutin 150000 netflix tgl 5`'
    };
  }

  const formattedName = parsed.name.charAt(0).toUpperCase() + parsed.name.slice(1);

  const item: RecurringExpense = {
    id: crypto.randomUUID(),
    name: formattedName,
    amount: parsed.amount,
    category: parsed.category || 'Bills',
    due_date: parsed.dueDate,
    active: true,
    created_at: new Date().toISOString()
  };

  await addRecurringExpense(item);

  const replyText =
    `🔁 *Pengeluaran Rutin Tersimpan!*\n\n` +
    `• Nama: *${item.name}*\n` +
    `• Jumlah: *${formatRp(item.amount)}*\n` +
    `• Kategori: ${item.category}\n` +
    `• Tanggal Jatuh Tempo: *Tiap tanggal ${item.due_date}*\n` +
    `• Status: *Aktif* ✅\n\n` +
    `_Bot akan otomatis mencatatnya ke Google Sheets setiap bulan dan mengirim notifikasi WhatsApp._`;

  return { success: true, replyText };
}

/**
 * Handle listing active recurring expenses
 */
async function handleListRecurring(): Promise<ExecutionResult> {
  const list = await getRecurringExpenses();
  const activeList = list.filter(r => r.active);

  if (activeList.length === 0) {
    return {
      success: true,
      replyText:
        `📋 *Pengeluaran Rutin Kosong*\n\n` +
        `Anda belum menambahkan pengeluaran rutin.\n` +
        `Untuk menambahkan, kirim:\n` +
        `\`tambah rutin 150000 netflix tgl 5\``
    };
  }

  const totalMonthly = activeList.reduce((sum, r) => sum + r.amount, 0);
  const itemsText = activeList
    .map((r, i) => `${i + 1}. *${r.name}* — ${formatRp(r.amount)} (Tgl ${r.due_date}) [${r.category}]`)
    .join('\n');

  const replyText =
    `📋 *Daftar Pengeluaran Rutin Aktif:*\n\n` +
    `${itemsText}\n\n` +
    `💰 *Total Rutin:* *${formatRp(totalMonthly)}* / bulan\n\n` +
    `_Untuk menonaktifkan, kirim: \`hapus rutin <nama>\`_`;

  return { success: true, replyText };
}

/**
 * Handle disabling a recurring expense
 */
async function handleDeleteRecurring(name: string): Promise<ExecutionResult> {
  if (!name) {
    return {
      success: false,
      replyText: '⚠️ Mohon sebutkan nama pengeluaran rutin. Contoh: `hapus rutin netflix`'
    };
  }

  const ok = await toggleRecurringExpense(name, false);
  if (!ok) {
    return {
      success: false,
      replyText: `⚠️ Pengeluaran rutin dengan nama *${name}* tidak ditemukan.`
    };
  }

  const replyText = `✅ Pengeluaran rutin *${name}* berhasil dinonaktifkan.`;
  return { success: true, replyText };
}

/**
 * Handle unknown / help message
 */
function handleHelp(rawText: string): ExecutionResult {
  const replyText =
    `🤔 *Format pesan belum dikenali:* "${rawText}"\n\n` +
    `*Contoh format yang didukung:*\n` +
    `• Catat Pengeluaran: \`keluar 25000 makan siang\`\n` +
    `• Catat Pemasukan: \`masuk 5000000 gaji\`\n` +
    `• Ringkasan: \`ringkasan hari\` / \`minggu\` / \`bulan\`\n` +
    `• Batalkan Transaksi: \`hapus terakhir\`\n` +
    `• Ubah Jumlah: \`edit terakhir 30000\`\n` +
    `• AI Financial Advisor: \`saran\`\n` +
    `• Pengeluaran Rutin: \`tambah rutin 150k netflix tgl 5\`\n` +
    `• Menu Pilihan: \`menu\``;

  return { success: false, replyText };
}

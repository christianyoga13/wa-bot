import { NextResponse } from 'next/server';
import { isSheetsConfigured } from '@/lib/sheets';
import { isWhatsAppConfigured } from '@/lib/whatsapp';

export async function GET() {
  const sheetsOk = isSheetsConfigured();
  const whatsappOk = isWhatsAppConfigured();
  const geminiOk = !!process.env.GEMINI_API_KEY;
  const cronOk = !!process.env.CRON_SECRET;
  const allowedPhone = process.env.ALLOWED_PHONE_NUMBER || null;

  return NextResponse.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    services: {
      googleSheets: {
        configured: sheetsOk,
        status: sheetsOk ? 'Connected to Google Sheets API' : 'Using Local In-Memory Fallback',
        freeTier: 'Free (Google Cloud 300 req/min quota — 100% free for personal use)'
      },
      whatsappCloudApi: {
        configured: whatsappOk,
        status: whatsappOk ? 'Configured with Phone Number ID' : 'Local Mock Mode (Logs to console)',
        freeTier: 'Free (Meta Developer Free Tier: 1,000 service conversations/month)'
      },
      geminiAiAdvisor: {
        configured: geminiOk,
        status: geminiOk ? 'Configured with Google AI Studio Key' : 'API Key Missing (Needs GEMINI_API_KEY)',
        model: 'gemini-2.0-flash',
        freeTier: 'Free (Google AI Studio: 15 RPM / 1,500 RPD — 100% free without credit card)'
      },
      vercelCron: {
        configured: true,
        secretConfigured: cronOk,
        schedule: 'Every day at 00:00 UTC (vercel.json)',
        freeTier: 'Free (Vercel Hobby Plan includes 1 cron job/day)'
      }
    },
    security: {
      allowedPhoneNumber: allowedPhone ? `${allowedPhone.slice(0, 4)}****${allowedPhone.slice(-4)}` : 'Open / Unrestricted (Set ALLOWED_PHONE_NUMBER for single-user security)'
    }
  });
}

import { NextResponse } from 'next/server';
import { ensureSheetStructure, isSheetsConfigured } from '@/lib/sheets';

export async function POST() {
  if (!isSheetsConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: 'Google Sheets credentials are not configured in environment variables. Running in local mock mode.'
      },
      { status: 400 }
    );
  }

  try {
    await ensureSheetStructure();
    return NextResponse.json({
      success: true,
      message: 'Sheet tabs ("transactions", "categories", "recurring_expenses") and headers successfully verified/created!'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { handleUserMessage } from '@/lib/transactions';
import { parseMessage } from '@/lib/parser';
import { getCategoryMappings } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text || '').trim();
    const phone = body.phone || '6281234567890';

    if (!text) {
      return NextResponse.json({ error: 'Text message is required' }, { status: 400 });
    }

    const categoryMap = await getCategoryMappings();
    const parsed = parseMessage(text, categoryMap);
    const result = await handleUserMessage(text, phone);

    return NextResponse.json({
      status: 'ok',
      input: text,
      parsed,
      result
    });
  } catch (err: any) {
    console.error('Error in simulate API:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}

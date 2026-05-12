import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request, context: { waitUntil: (promise: Promise<any>) => void }) {
  context.waitUntil(Promise.resolve());
  return NextResponse.json({ ok: true });
}

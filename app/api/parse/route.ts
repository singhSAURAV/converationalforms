import { NextRequest, NextResponse } from 'next/server'
import { parseForm } from '@/lib/parser'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 })
    }

    const form = await parseForm(url.trim())
    return NextResponse.json(form)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse form.'
    const status = message.includes('login') || message.includes('Invalid') || message.includes('empty') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

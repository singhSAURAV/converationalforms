import { NextRequest, NextResponse } from 'next/server'
import { getNextMessage } from '@/lib/chat'
import { FormField, ChatMessage } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { field, messages, userMessage } = await req.json() as {
      field: FormField
      messages: ChatMessage[]
      userMessage?: string
    }

    if (!field) {
      return NextResponse.json({ error: 'field is required.' }, { status: 400 })
    }

    const result = await getNextMessage(field, messages ?? [], userMessage)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claude API error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

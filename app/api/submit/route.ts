import { NextRequest, NextResponse } from 'next/server'
import { submitForm } from '@/lib/submitter'

export async function POST(req: NextRequest) {
  try {
    const { actionUrl, answers } = await req.json() as {
      actionUrl: string
      answers: Record<string, string | string[]>
    }

    if (!actionUrl || !answers) {
      return NextResponse.json({ error: 'actionUrl and answers are required.' }, { status: 400 })
    }

    const result = await submitForm(actionUrl, answers)

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Submission failed.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Submission error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

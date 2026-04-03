import Anthropic from '@anthropic-ai/sdk'
import { FormField, ChatMessage } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a friendly assistant collecting form responses through conversation.
Ask one question at a time. Be warm and natural — not robotic.
Never say "Question X of Y". Never use form jargon.
If the question has specific options, present them clearly.
If an answer is invalid or unclear, ask again politely.
Keep all responses under 3 sentences.
When you have accepted a valid answer, end your message with exactly:
[ANSWER: <the extracted answer value>]
For multiple choice, the ANSWER must exactly match one of the valid options.
For checkboxes, use comma-separated values: [ANSWER: option1, option2]`

function buildFieldContext(field: FormField): string {
  const lines: string[] = [
    `Current question: "${field.question}"`,
    `Field type: ${field.type}`,
    `Required: ${field.required ? 'yes' : 'no'}`,
  ]

  if (field.options.length > 0) {
    lines.push(`Valid options: ${field.options.join(', ')}`)
  }

  if (field.type === 'linear_scale') {
    lines.push(`Scale range: ${field.scaleMin ?? 1} to ${field.scaleMax ?? 10}`)
    if (field.scaleMinLabel) lines.push(`Min label: ${field.scaleMinLabel}`)
    if (field.scaleMaxLabel) lines.push(`Max label: ${field.scaleMaxLabel}`)
  }

  if (field.type === 'date') {
    lines.push('Expected format: YYYY-MM-DD')
  }

  return lines.join('\n')
}

export interface ChatResult {
  reply: string
  isAnswerAccepted: boolean
  extractedAnswer?: string | string[]
}

export async function getNextMessage(
  field: FormField,
  messages: ChatMessage[],
  userMessage?: string
): Promise<ChatResult> {
  const fieldContext = buildFieldContext(field)

  // Build messages array for Claude
  const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // If there's a new user message, append it
  if (userMessage) {
    claudeMessages.push({ role: 'user', content: userMessage })
  }

  // If no messages yet (first question for this field), prompt Claude to ask it
  if (claudeMessages.length === 0) {
    claudeMessages.push({
      role: 'user',
      content: `Please ask the following question in a friendly, conversational way. Field context:\n${fieldContext}`,
    })
  }

  const systemWithContext = `${SYSTEM_PROMPT}\n\n--- Current field context ---\n${fieldContext}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: systemWithContext,
    messages: claudeMessages,
  })

  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Parse [ANSWER: ...] tag
  const answerMatch = rawText.match(/\[ANSWER:\s*(.*?)\]/)
  if (answerMatch) {
    const rawAnswer = answerMatch[1].trim()
    const reply = rawText.replace(/\[ANSWER:\s*.*?\]/, '').trim()

    let extractedAnswer: string | string[]
    if (field.type === 'checkbox') {
      extractedAnswer = rawAnswer.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      extractedAnswer = rawAnswer
    }

    return { reply, isAnswerAccepted: true, extractedAnswer }
  }

  return { reply: rawText, isAnswerAccepted: false }
}

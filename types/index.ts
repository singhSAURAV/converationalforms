export type FieldType =
  | 'text'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkbox'
  | 'dropdown'
  | 'linear_scale'
  | 'date'
  | 'unsupported'

export interface FormField {
  id: string            // e.g. "entry.1234567890"
  question: string
  type: FieldType
  required: boolean
  options: string[]     // for multiple_choice, checkbox, dropdown
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMaxLabel?: string
}

export interface ParsedForm {
  title: string
  description: string
  fields: FormField[]
  actionUrl: string     // POST endpoint for submission
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FormState {
  form: ParsedForm | null
  currentFieldIndex: number
  answers: Record<string, string | string[]>
  messages: ChatMessage[]
  status: 'idle' | 'loading' | 'chatting' | 'complete' | 'submitted' | 'error'
  error?: string
}

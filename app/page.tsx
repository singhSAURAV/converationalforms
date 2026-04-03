'use client'

import { useReducer, useCallback } from 'react'
import { FormState, ChatMessage, ParsedForm } from '@/types'
import UrlForm from '@/components/UrlForm'
import ChatWindow from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import ProgressBar from '@/components/ProgressBar'

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: ParsedForm }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'ANSWER_ACCEPTED'; entryId: string; answer: string | string[] }
  | { type: 'SET_COMPLETE' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'SET_LOADING_CHAT'; value: boolean }

interface ExtendedState extends FormState {
  isLoadingChat: boolean
}

const initialState: ExtendedState = {
  form: null,
  currentFieldIndex: 0,
  answers: {},
  messages: [],
  status: 'idle',
  isLoadingChat: false,
}

function reducer(state: ExtendedState, action: Action): ExtendedState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading', error: undefined }
    case 'LOAD_SUCCESS':
      return {
        ...state,
        form: action.payload,
        status: 'chatting',
        currentFieldIndex: 0,
        answers: {},
        messages: [],
      }
    case 'LOAD_ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'ANSWER_ACCEPTED': {
      const newAnswers = { ...state.answers, [action.entryId]: action.answer }
      const nextIndex = state.currentFieldIndex + 1
      const fields = state.form?.fields ?? []
      // Skip unsupported fields
      let skipIndex = nextIndex
      while (skipIndex < fields.length && fields[skipIndex].type === 'unsupported') {
        skipIndex++
      }
      return {
        ...state,
        answers: newAnswers,
        currentFieldIndex: skipIndex,
      }
    }
    case 'SET_COMPLETE':
      return { ...state, status: 'complete' }
    case 'SUBMIT_START':
      return { ...state, status: 'loading' }
    case 'SUBMIT_SUCCESS':
      return { ...state, status: 'submitted' }
    case 'SUBMIT_ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'RESET':
      return initialState
    case 'SET_LOADING_CHAT':
      return { ...state, isLoadingChat: action.value }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState)
  // ------------------------------------------------------------------
  // Load form
  // ------------------------------------------------------------------
  const handleLoadForm = useCallback(async (url: string) => {
    dispatch({ type: 'LOAD_START' })

    let parsedForm: ParsedForm
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load form.')
      parsedForm = data as ParsedForm
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', error: err instanceof Error ? err.message : 'Failed to load form.' })
      return
    }

    dispatch({ type: 'LOAD_SUCCESS', payload: parsedForm })

    // Find first non-unsupported field
    const firstFieldIndex = parsedForm.fields.findIndex((f) => f.type !== 'unsupported')
    if (firstFieldIndex === -1) {
      dispatch({ type: 'LOAD_ERROR', error: 'This form has no supported fields.' })
      return
    }

    // Add note about skipped file upload fields if any
    const hasUnsupported = parsedForm.fields.some((f) => f.type === 'unsupported')
    if (hasUnsupported) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          role: 'assistant',
          content: "I'll skip the file upload field — you can add that directly in the original form.",
        },
      })
    }

    // Ask first question
    await askQuestion(parsedForm, firstFieldIndex, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------------
  // Ask a question (calls /api/chat with no userMessage)
  // ------------------------------------------------------------------
  async function askQuestion(
    form: ParsedForm,
    fieldIndex: number,
    currentMessages: ChatMessage[]
  ) {
    const field = form.fields[fieldIndex]
    if (!field) return

    dispatch({ type: 'SET_LOADING_CHAT', value: true })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, messages: currentMessages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chat error.')

      dispatch({
        type: 'ADD_MESSAGE',
        message: { role: 'assistant', content: data.reply },
      })
    } catch (err) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          role: 'assistant',
          content: 'Sorry, I had trouble connecting. Please try again.',
        },
      })
    } finally {
      dispatch({ type: 'SET_LOADING_CHAT', value: false })
    }
  }

  // ------------------------------------------------------------------
  // Handle user sending a message
  // ------------------------------------------------------------------
  const handleSend = useCallback(
    async (userMessage: string) => {
      if (!state.form) return
      const fields = state.form.fields
      const fieldIndex = state.currentFieldIndex
      const field = fields[fieldIndex]
      if (!field) return

      // Add user message to history
      const userMsg: ChatMessage = { role: 'user', content: userMessage }
      dispatch({ type: 'ADD_MESSAGE', message: userMsg })

      const updatedMessages: ChatMessage[] = [...state.messages, userMsg]

      dispatch({ type: 'SET_LOADING_CHAT', value: true })
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field,
            messages: updatedMessages,
            userMessage,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Chat error.')

        const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply }
        dispatch({ type: 'ADD_MESSAGE', message: assistantMsg })

        if (data.isAnswerAccepted) {
          dispatch({
            type: 'ANSWER_ACCEPTED',
            entryId: field.id,
            answer: data.extractedAnswer,
          })

          const nextIndex = fieldIndex + 1
          // Calculate next non-unsupported field
          let skipIndex = nextIndex
          while (skipIndex < fields.length && fields[skipIndex].type === 'unsupported') {
            skipIndex++
          }

          if (skipIndex >= fields.length) {
            // All done
            dispatch({ type: 'SET_COMPLETE' })
          } else {
            // Ask next question — pass current messages + the two new ones
            const messagesForNext = [...updatedMessages, assistantMsg]
            await askQuestion(state.form, skipIndex, messagesForNext)
          }
        }
      } catch (err) {
        dispatch({
          type: 'ADD_MESSAGE',
          message: {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          },
        })
      } finally {
        dispatch({ type: 'SET_LOADING_CHAT', value: false })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.form, state.currentFieldIndex, state.messages]
  )

  // ------------------------------------------------------------------
  // Submit form
  // ------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!state.form) return
    dispatch({ type: 'SUBMIT_START' })

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionUrl: state.form.actionUrl,
          answers: state.answers,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed.')
      dispatch({ type: 'SUBMIT_SUCCESS' })
    } catch (err) {
      dispatch({
        type: 'SUBMIT_ERROR',
        error: err instanceof Error ? err.message : 'Submission failed.',
      })
    }
  }, [state.form, state.answers])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const isIdle = state.status === 'idle' || state.status === 'error'
  const isChatting = state.status === 'chatting' || state.status === 'complete' || state.status === 'submitted'
  const fields = state.form?.fields ?? []
  const supportedFields = fields.filter((f) => f.type !== 'unsupported')

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ backgroundColor: '#FAFAF9' }}
    >
      {/* Header */}
      <header className="w-full max-w-2xl px-4 pt-8 pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">FormConv</h1>
          {!isChatting && (
            <p className="text-sm text-[#888]">Turn any Google Form into a conversation</p>
          )}
          {isChatting && state.form && (
            <p className="text-sm text-[#888] truncate">{state.form.title}</p>
          )}
        </div>
      </header>

      {/* Landing / URL input */}
      {isIdle && (
        <main className="flex flex-col items-center justify-center flex-1 px-4 pb-16 w-full">
          <div className="flex flex-col items-center gap-6 w-full max-w-xl">
            <p className="text-sm text-[#555] text-center">
              Paste a public Google Form URL below — no Google API key needed.
            </p>
            <UrlForm
              onSubmit={handleLoadForm}
              isLoading={state.status === 'loading'}
              error={state.status === 'error' ? state.error : undefined}
            />
          </div>
        </main>
      )}

      {/* Loading form */}
      {state.status === 'loading' && !isChatting && (
        <main className="flex flex-col items-center justify-center flex-1 px-4">
          <p className="text-sm text-[#888]">Loading form...</p>
        </main>
      )}

      {/* Chat view */}
      {isChatting && (
        <main className="flex flex-col w-full max-w-2xl flex-1 px-4 pb-4" style={{ minHeight: 0 }}>
          <div
            className="flex flex-col flex-1 border border-[#E8E7E5] bg-white overflow-hidden"
            style={{ borderRadius: '2px', height: 'calc(100vh - 120px)' }}
          >
            <ProgressBar
              current={state.currentFieldIndex}
              total={supportedFields.length}
              visible={state.status === 'chatting'}
            />

            <ChatWindow messages={state.messages} isLoading={state.isLoadingChat} />

            {/* Completion state */}
            {state.status === 'complete' && (
              <div className="px-4 py-3 border-t border-[#E8E7E5] bg-[#FAFAF9] flex flex-col gap-2">
                <p className="text-sm text-[#555]">All questions answered. Ready to submit?</p>
                <button
                  onClick={handleSubmit}
                  className="self-start px-5 py-2.5 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors"
                  style={{ borderRadius: '2px' }}
                >
                  Submit your responses
                </button>
              </div>
            )}

            {/* Submitted state */}
            {state.status === 'submitted' && (
              <div className="px-4 py-3 border-t border-[#E8E7E5] bg-[#FAFAF9] flex flex-col gap-2">
                <p className="text-sm text-[#1A1A1A] font-medium">
                  Your responses have been recorded ✓
                </p>
                <button
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="self-start px-4 py-2 text-xs border border-[#DDDBD8] text-[#555] hover:border-[#888] transition-colors"
                  style={{ borderRadius: '2px' }}
                >
                  Start with a new form
                </button>
              </div>
            )}

            {/* Submission failed */}
            {state.status === 'error' && state.form && (
              <div className="px-4 py-3 border-t border-[#E8E7E5] bg-[#FAFAF9] flex flex-col gap-2">
                <p className="text-sm text-red-600">{state.error}</p>
                <details className="text-xs text-[#888]">
                  <summary className="cursor-pointer hover:text-[#555]">
                    View your answers to enter manually
                  </summary>
                  <pre className="mt-2 p-3 bg-[#F0EFED] overflow-x-auto text-[#1A1A1A]">
                    {JSON.stringify(state.answers, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {/* Input bar — only during active chatting */}
            {state.status === 'chatting' && (
              <ChatInput onSend={handleSend} disabled={state.isLoadingChat} />
            )}
          </div>
        </main>
      )}
    </div>
  )
}

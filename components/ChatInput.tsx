'use client'

import { useState, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 px-4 py-3 border-t border-[#E8E7E5] bg-[#FAFAF9]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Waiting...' : 'Type your answer...'}
        className="flex-1 px-3 py-2 text-sm border border-[#DDDBD8] bg-white text-[#1A1A1A] placeholder-[#AAAAAA] focus:outline-none focus:border-[#888] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderRadius: '2px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ borderRadius: '2px' }}
      >
        Send
      </button>
    </div>
  )
}

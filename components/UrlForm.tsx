'use client'

import { useState, KeyboardEvent } from 'react'

interface UrlFormProps {
  onSubmit: (url: string) => void
  isLoading: boolean
  error?: string
}

export default function UrlForm({ onSubmit, isLoading, error }: UrlFormProps) {
  const [url, setUrl] = useState('')

  function handleSubmit() {
    const trimmed = url.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-xl">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Paste a Google Form URL..."
          className="flex-1 px-4 py-3 text-sm border border-[#DDDBD8] bg-white text-[#1A1A1A] placeholder-[#AAAAAA] focus:outline-none focus:border-[#888] disabled:opacity-50"
          style={{ borderRadius: '2px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !url.trim()}
          className="px-5 py-3 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          style={{ borderRadius: '2px' }}
        >
          {isLoading ? 'Loading...' : 'Start Conversation'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 px-1">{error}</p>
      )}
    </div>
  )
}

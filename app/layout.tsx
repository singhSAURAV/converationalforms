import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FormConv — Turn any Google Form into a conversation',
  description:
    'Paste a public Google Form URL and get a friendly chat interface. No Google API key needed.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

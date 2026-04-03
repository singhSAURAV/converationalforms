# FormConv — Project Specification for Claude Code

> Turn any public Google Form into a conversational chat interface.
> Paste a URL, get a chatbot. Deployable on Vercel in one click.

---

## What You're Building

A Next.js web app where a user pastes a public Google Form URL, and the app:
1. Parses all form fields server-side (questions, types, options, required status)
2. Presents them as a natural conversational chat interface in the browser
3. Collects all answers through chat
4. Submits responses back to the original Google Form

The form owner sees responses in their Google Sheet as normal. Nothing changes on their end.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Anthropic Claude API · Vercel (deployment)

---

## Project Structure

```
formconv/
├── README.md
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── package.json
├── app/
│   ├── layout.tsx               ← root layout, fonts, metadata
│   ├── page.tsx                 ← landing page with URL input + chat view
│   ├── globals.css
│   └── api/
│       ├── parse/
│       │   └── route.ts         ← POST: scrape & parse Google Form URL
│       ├── chat/
│       │   └── route.ts         ← POST: call Claude API, return next message
│       └── submit/
│           └── route.ts         ← POST: submit answers to Google Forms
├── components/
│   ├── ChatWindow.tsx           ← scrollable message history
│   ├── ChatInput.tsx            ← input bar + send button
│   ├── UrlForm.tsx              ← landing URL paste input
│   └── ProgressBar.tsx          ← subtle question progress indicator
├── lib/
│   ├── parser.ts                ← Google Form scraper (Cheerio)
│   ├── chat.ts                  ← Claude API call logic
│   └── submitter.ts             ← Google Forms POST logic
└── types/
    └── index.ts                 ← shared TypeScript types
```

---

## Shared Types (`types/index.ts`)

```typescript
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
  answers: Record<string, string | string[]>  // entry.ID -> answer
  messages: ChatMessage[]
  status: 'idle' | 'loading' | 'chatting' | 'complete' | 'submitted' | 'error'
  error?: string
}
```

---

## API Routes

### `POST /api/parse`

Scrapes a public Google Form and returns structured field data.

**Request:**
```json
{ "url": "https://docs.google.com/forms/d/e/FORM_ID/viewform" }
```

**Response:**
```json
{
  "title": "Customer Feedback",
  "description": "We'd love to hear from you.",
  "fields": [...],
  "actionUrl": "https://docs.google.com/forms/d/e/FORM_ID/formResponse"
}
```

**Implementation (`lib/parser.ts`):**

- Use `cheerio` to parse the HTML of the Google Form URL
- Google Forms embeds ALL form data as a JS variable called `FB_PUBLIC_LOAD_DATA_` inside a `<script>` tag — this is the most reliable extraction method
- Extract this variable's value using a regex match, then `JSON.parse()` it
- The data structure is a deeply nested array — field data lives at index `[1][1]`
- Each field is an array where:
  - `[1]` = question text
  - `[3]` = field type integer (0=short text, 1=paragraph, 2=MCQ, 3=dropdown, 4=checkbox, 5=linear scale, 9=date)
  - `[4][0][0]` = entry ID number (prepend `entry.` to form the key)
  - `[4][0][1]` = options array (for MCQ/dropdown/checkbox)
- Convert action URL: replace `/viewform` with `/formResponse` at the end of the URL
- Return a clean `ParsedForm` object

**Error handling:**
- Invalid URL → 400 with message
- Private/login-required form → 400: "This form requires login. Only public forms are supported."
- Network failure → 500

---

### `POST /api/chat`

Calls Claude to generate the next conversational message.

**Request:**
```json
{
  "field": { ...FormField },
  "messages": [...ChatMessage],
  "userMessage": "John Smith"
}
```

**Response:**
```json
{
  "reply": "Thanks John! Next question...",
  "isAnswerAccepted": true,
  "extractedAnswer": "John Smith"
}
```

**Implementation (`lib/chat.ts`):**

System prompt to pass to Claude:
```
You are a friendly assistant collecting form responses through conversation.
Ask one question at a time. Be warm and natural — not robotic.
Never say "Question X of Y". Never use form jargon.
If the question has specific options, present them clearly.
If an answer is invalid or unclear, ask again politely.
Keep all responses under 3 sentences.
When you have accepted a valid answer, end your message with exactly:
[ANSWER: <the extracted answer value>]
For multiple choice, the ANSWER must exactly match one of the valid options.
For checkboxes, use comma-separated values: [ANSWER: option1, option2]
```

- Model: `claude-haiku-4-5`
- Max tokens: 300 (keep responses short)
- Parse `[ANSWER: ...]` tag from Claude's response to detect when an answer is confirmed
- Strip the tag before returning `reply` to the frontend
- Return `isAnswerAccepted: true` and `extractedAnswer` when tag is found

---

### `POST /api/submit`

Posts collected answers back to Google Forms.

**Request:**
```json
{
  "actionUrl": "https://docs.google.com/forms/d/.../formResponse",
  "answers": {
    "entry.1234567890": "John Smith",
    "entry.0987654321": ["Option A", "Option C"]
  }
}
```

**Response:**
```json
{ "success": true }
```

**Implementation (`lib/submitter.ts`):**

- Build a `URLSearchParams` payload from the answers object
- For array values (checkboxes), append the same key multiple times — one per selected value
- POST to `actionUrl` with header `Content-Type: application/x-www-form-urlencoded`
- Add `User-Agent: Mozilla/5.0` header to avoid blocks
- Google Forms returns a 200 with HTML containing "Your response has been recorded" on success
- Set `redirect: 'follow'` and check response text for that string

---

## Frontend Pages & Components

### `app/page.tsx` — Landing / URL Input

- Clean centered layout
- App name + one-line description
- Large URL input field with placeholder: `Paste a Google Form URL...`
- "Start Conversation" button
- On submit: POST to `/api/parse`, store result, transition to chat view
- Show loading spinner while parsing
- Show inline error if parse fails

### Chat View (same page, conditional render based on state)

Once a form is loaded, the page transitions to:

```
[Form title at top — subtle, small]
[Progress indicator — "Question 2 of 7"]
[Chat window — scrollable, fills most of viewport]
[Input bar — pinned to bottom]
```

### `components/ChatWindow.tsx`

- Renders list of `ChatMessage` objects
- Assistant messages: left-aligned bubble
- User messages: right-aligned bubble
- Auto-scrolls to latest message
- Shows a typing indicator (animated dots) while waiting for Claude response

### `components/ChatInput.tsx`

- Text input + Send button
- Submit on Enter key or button click
- Disabled while Claude is responding
- Clears after each send

### `components/ProgressBar.tsx`

- Thin progress bar or text indicator above chat
- Shows `Question X of Y` — subtle, not in the chat itself
- Disappears when form is complete

### Completion State

When all questions are answered:
- Chat shows a summary of answers
- "Submit your responses" button appears
- On submit: POST to `/api/submit`
- Show success message: "Your responses have been recorded ✓"
- Option to start over with a new form

---

## State Management

Use React `useState` and `useReducer` in `app/page.tsx` — no external state library needed.

```typescript
const [formState, dispatch] = useReducer(formReducer, {
  form: null,
  currentFieldIndex: 0,
  answers: {},
  messages: [],
  status: 'idle'
})
```

State transitions:
```
idle → loading (URL submitted)
loading → chatting (form parsed, first question sent)
chatting → chatting (each Q&A exchange)
chatting → complete (all fields answered)
complete → submitted (form POSTed to Google)
any → error (on failure)
```

---

## Environment Variables

```bash
# .env.example
ANTHROPIC_API_KEY=your_key_here
```

No other env vars needed. Google Forms parsing and submission requires no API key.

---

## package.json Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@anthropic-ai/sdk": "^0.25.0",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## UI Design Direction

Clean, minimal, functional. Not flashy.

- Background: off-white (`#FAFAF9`)
- Assistant bubbles: light grey (`#F0EFED`)
- User bubbles: near-black (`#1A1A1A`) with white text
- Font: System font stack — no Google Fonts dependency
- No rounded pill buttons — subtle rectangular buttons with light borders
- Typing indicator: three animated dots, grey
- No sidebar, no nav bar, no clutter

The interface should feel like iMessage met Typeform — familiar, focused.

---

## Vercel Deployment

The project must deploy to Vercel with zero configuration changes.

- All API routes use Next.js App Router `route.ts` convention — Vercel handles these as serverless functions automatically
- No custom `vercel.json` needed
- The only required env var on Vercel is `ANTHROPIC_API_KEY`
- Include a Deploy to Vercel button in the README

---

## Edge Cases to Handle

| Case | Handling |
|---|---|
| Private / login-required form | Error: "This form requires login. Only public forms are supported." |
| Form with no questions | Error: "This form appears to be empty." |
| File upload field | Skip silently, note in chat: "I'll skip the file upload field — you can add that directly in the original form." |
| Network timeout on parse | Retry once, then show error |
| MCQ with "Other" option | Treat as free text input |
| Multi-select checkbox | Collect as array, submit multiple entry values |
| Linear scale | Show range in chat, validate answer is within bounds |
| Form submission fails | Show error + display full answer summary so user can enter manually |
| User tries to skip required field | Claude re-asks, does not advance |

---

## What NOT to Build for v1

- No user accounts or auth
- No answer storage or database
- No analytics or tracking
- No private/authenticated Google Forms support
- No file upload field support
- No multi-language support
- No Typeform / Tally support (future)

---

## Definition of Done

- [ ] Paste any public Google Form URL → form parses and first question appears in chat
- [ ] All supported field types work: short text, paragraph, MCQ, dropdown, checkbox, linear scale, date
- [ ] Required field validation works — Claude re-asks if user tries to skip
- [ ] MCQ/dropdown options shown clearly, answer validated against valid options
- [ ] All answers submitted back to the real Google Form successfully
- [ ] Responses appear in the form owner's Google Sheet as normal
- [ ] Deployed and publicly accessible on Vercel
- [ ] One-click Deploy to Vercel button works from README
- [ ] Runs locally with `npm run dev` after `.env.local` setup
- [ ] Works end-to-end on at least 3 different real public Google Forms

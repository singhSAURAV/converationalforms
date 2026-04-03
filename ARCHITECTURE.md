# FormConv — Architecture

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — styling
- **Cheerio** — server-side HTML parsing
- **Anthropic SDK** (`claude-haiku-4-5`) — conversational AI
- No database. No auth. No external state.

---

## File Map

```
app/
  page.tsx              — entire UI + state machine (useReducer)
  layout.tsx            — root layout, metadata
  globals.css           — Tailwind base + body styles
  api/
    parse/route.ts      — POST: scrape form URL, return ParsedForm
    chat/route.ts       — POST: call Claude, return reply + extracted answer
    submit/route.ts     — POST: submit answers to Google Forms

components/
  UrlForm.tsx           — URL input + Start Conversation button
  ChatWindow.tsx        — message bubbles + typing indicator
  ChatInput.tsx         — text input + Send, Enter key support
  ProgressBar.tsx       — "Question X of Y" indicator

lib/
  parser.ts             — fetches form HTML, extracts FB_PUBLIC_LOAD_DATA_, returns ParsedForm
  chat.ts               — Claude API call, parses [ANSWER: ...] tag
  submitter.ts          — POSTs URLSearchParams to Google formResponse endpoint

types/index.ts          — FieldType, FormField, ParsedForm, ChatMessage, FormState
```

---

## Data Flow

```
User pastes URL
  → POST /api/parse
  → fetch(formUrl) → extract FB_PUBLIC_LOAD_DATA_ via regex
  → JSON.parse nested array → map to FormField[]
  → return ParsedForm { title, description, fields, actionUrl }

For each field:
  → POST /api/chat { field, messages, userMessage? }
  → Claude prompt includes field context (type, options, scale range)
  → Claude responds; if answer accepted, appends [ANSWER: value]
  → Strip tag, return { reply, isAnswerAccepted, extractedAnswer }
  → Frontend advances currentFieldIndex on isAnswerAccepted

All fields answered:
  → POST /api/submit { actionUrl, answers }
  → Build URLSearchParams (checkbox arrays → repeated keys)
  → POST to docs.google.com/forms/d/.../formResponse
  → Check response body for "Your response has been recorded"
```

---

## State Machine (`app/page.tsx`)

```
idle → loading → chatting → complete → submitted
               ↘ error (any stage)
```

Managed with `useReducer`. Full state:

```ts
{
  form: ParsedForm | null
  currentFieldIndex: number
  answers: Record<string, string | string[]>   // entry.ID → value
  messages: ChatMessage[]
  status: 'idle'|'loading'|'chatting'|'complete'|'submitted'|'error'
  isLoadingChat: boolean
}
```

---

## Google Form Parsing

`FB_PUBLIC_LOAD_DATA_` is a JS variable embedded in every public Google Form's HTML.

```
data[1][0]  → description (string)
data[1][1]  → fields array
data[1][8]  → title (string)

Per field (data[1][1][i]):
  [1]       → question text
  [3]       → type int (0=text,1=paragraph,2=MCQ,3=dropdown,4=checkbox,5=scale,9=date)
  [4][0][0] → entry ID number  →  prepend "entry." for POST key
  [4][0][1] → options array (MCQ/dropdown/checkbox)
  [4][0][2] → required (1 = required)
```

Login detection: check `res.url` (final URL after redirects) for `accounts.google.com` — not the HTML body, which always references it.

---

## Claude Answer Extraction

Claude is instructed to end its message with `[ANSWER: value]` once it accepts a valid answer. The route strips the tag before returning `reply` to the frontend.

- Text/paragraph: raw user input
- MCQ/dropdown: must match a valid option exactly
- Checkbox: comma-separated → `string[]`
- Linear scale: integer within `[scaleMin, scaleMax]`
- File upload fields: `type = 'unsupported'`, skipped silently

---

## API Key Handling

Set `ANTHROPIC_API_KEY` in `.env.local`. The `Anthropic` client in `lib/chat.ts` reads it at module load via `process.env.ANTHROPIC_API_KEY`. Requires a server restart to take effect.

---

## Form Submission

Google Forms accepts unauthenticated POST to `/formResponse` with `application/x-www-form-urlencoded`. Checkboxes require the same key appended multiple times (`params.append(key, val)` per item). Success is detected by presence of `"Your response has been recorded"` in the response HTML (no JSON API).

# FormConv

**Turn any Google Form into a conversation. Paste a URL, get a chatbot.**

No Google API key. No backend setup. Works with any public Google Form — the form owner sees responses in their Google Sheet as normal.

![demo](demo.gif)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/formconv&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key&envLink=https://console.anthropic.com/)

---

## Why

Google Forms are useful but cold. A conversational interface that asks one question at a time — naturally, with context — gets better completion rates and actually feels human.

FormConv converts any public Google Form into a chat experience, then submits the responses back to the original form. Nothing changes for the form owner.

---

## How It Works

1. **Parse** — Paste a public Google Form URL. FormConv extracts all fields, types, and options server-side. No Google API key needed.
2. **Chat** — Claude guides the respondent through each question conversationally, one at a time, handling validation naturally.
3. **Submit** — Answers are posted back to the original Google Form. Responses appear in the form owner's Google Sheet as normal.

---

## Quickstart (Local)

```bash
git clone https://github.com/yourusername/formconv.git
cd formconv

npm install

cp .env.example .env.local
# Add your Anthropic API key to .env.local

npm run dev
```

Open `http://localhost:3000`, paste any public Google Form URL, and start chatting.

---

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/formconv&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key&envLink=https://console.anthropic.com/)

The only environment variable you need is `ANTHROPIC_API_KEY`. Everything else works out of the box.

---

## Supported Field Types

| Field Type | Supported |
|---|---|
| Short text | ✅ |
| Paragraph (long text) | ✅ |
| Multiple choice | ✅ |
| Dropdown | ✅ |
| Checkboxes (multi-select) | ✅ |
| Linear scale | ✅ |
| Date | ✅ |
| File upload | ❌ (skipped with note) |

---

## Stack

- [Next.js 14](https://nextjs.org/) (App Router) — frontend + API routes
- [Anthropic Claude](https://anthropic.com/) (`claude-haiku-4-5`) — conversational engine
- [Cheerio](https://cheerio.js.org/) — server-side form parsing
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Vercel](https://vercel.com/) — deployment

---

## Limitations

- **Public forms only** — forms requiring a Google login cannot be parsed
- **File upload fields** are skipped (Google Forms handles these server-side)
- **No answer storage** — responses go directly to Google Forms, nothing is saved by FormConv
- Google may rate-limit repeated scraping of the same form URL

---

## Project Structure

```
formconv/
├── app/
│   ├── page.tsx              # Chat UI + state machine
│   └── api/
│       ├── parse/route.ts    # Scrapes Google Form fields
│       ├── chat/route.ts     # Calls Claude API
│       └── submit/route.ts   # Posts to Google Forms
├── components/               # ChatWindow, ChatInput, ProgressBar, UrlForm
├── lib/                      # parser.ts, chat.ts, submitter.ts
└── types/index.ts            # Shared TypeScript types
```

---

## Contributing

PRs welcome. Most wanted for v2:

- React embeddable widget (drop into any webpage with a `<script>` tag)
- Typeform and Tally URL support
- Streaming Claude responses
- Multi-language support

---

## License

MIT — use it, fork it, build on it.

---

*Built by [Saurav]([https://github.com/](https://github.com/singhSAURAV)) · Part of an ongoing series on practical AI tooling for SMEs in SEA*

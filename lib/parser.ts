import * as cheerio from 'cheerio'
import { FormField, FieldType, ParsedForm } from '@/types'

const TYPE_MAP: Record<number, FieldType> = {
  0: 'text',
  1: 'paragraph',
  2: 'multiple_choice',
  3: 'dropdown',
  4: 'checkbox',
  5: 'linear_scale',
  9: 'date',
  10: 'unsupported', // time — not fully supported
}

export function extractActionUrl(formUrl: string): string {
  return formUrl.replace(/\/viewform.*$/, '/formResponse')
}

export async function parseForm(url: string): Promise<ParsedForm> {
  // Validate URL shape
  if (!url.includes('docs.google.com/forms')) {
    throw new Error('Invalid URL. Please paste a Google Forms URL.')
  }

  const HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }

  let html: string
  let finalUrl: string
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
    html = await res.text()
    finalUrl = res.url
  } catch {
    // Retry once
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
      html = await res.text()
      finalUrl = res.url
    } catch {
      throw new Error('Network error: could not reach the form URL. Please check your connection.')
    }
  }

  // Check for login redirect — only flag if the request was actually redirected to accounts.google.com
  if (finalUrl.includes('accounts.google.com') || finalUrl.includes('ServiceLogin')) {
    throw new Error('This form requires login. Only public forms are supported.')
  }

  // Extract FB_PUBLIC_LOAD_DATA_
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/)
  if (!match) {
    // Try alternate pattern
    const match2 = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);/)
    if (!match2) {
      throw new Error(
        'Could not parse this form. It may be private or use an unsupported format.'
      )
    }
    return parseDataBlob(match2[1], url)
  }

  return parseDataBlob(match[1], url)
}

function parseDataBlob(blob: string, formUrl: string): ParsedForm {
  let data: unknown[]
  try {
    data = JSON.parse(blob) as unknown[]
  } catch {
    throw new Error('Failed to parse form data. The form structure may have changed.')
  }

  // Navigate the nested structure
  // data[1][0] = description, data[1][8] = title, data[1][1] = fields array
  const formInfo = data[1] as unknown[]
  const title = (formInfo[8] as string) ?? 'Untitled Form'
  const description = (formInfo[0] as string) ?? ''

  // The fields array lives at data[1][1]
  const rawFields = (formInfo[1] as unknown[][]) ?? []

  if (!rawFields || rawFields.length === 0) {
    throw new Error('This form appears to be empty.')
  }

  const fields: FormField[] = []

  for (const rawField of rawFields) {
    if (!Array.isArray(rawField)) continue

    const question = rawField[1] as string
    const typeInt = rawField[3] as number
    const fieldType: FieldType = TYPE_MAP[typeInt] ?? 'unsupported'

    // Entry ID and options live in rawField[4][0]
    const fieldData = rawField[4] as unknown[][] | undefined
    if (!fieldData || !fieldData[0]) {
      // Section headers and page breaks have no entry data — skip
      continue
    }

    const entryIdRaw = fieldData[0][0] as number
    const entryId = `entry.${entryIdRaw}`

    // Options: rawField[4][0][1] is an array of option arrays, each option[0] = label
    const rawOptions = fieldData[0][1] as unknown[][] | undefined
    const options: string[] = rawOptions
      ? rawOptions.map((opt) => (opt[0] as string) ?? '').filter(Boolean)
      : []

    // Required: rawField[4][0][2] === 1
    const required = (fieldData[0][2] as number) === 1

    // Linear scale: rawField[4][0][3] = [min, max], rawField[4][0][4] = [min_label, max_label]
    let scaleMin: number | undefined
    let scaleMax: number | undefined
    let scaleMinLabel: string | undefined
    let scaleMaxLabel: string | undefined

    if (fieldType === 'linear_scale') {
      const scaleBounds = fieldData[0][3] as number[] | undefined
      if (scaleBounds) {
        scaleMin = scaleBounds[0]
        scaleMax = scaleBounds[1]
      }
      const scaleLabels = fieldData[0][4] as string[] | undefined
      if (scaleLabels) {
        scaleMinLabel = scaleLabels[0]
        scaleMaxLabel = scaleLabels[1]
      }
    }

    fields.push({
      id: entryId,
      question,
      type: fieldType,
      required,
      options,
      scaleMin,
      scaleMax,
      scaleMinLabel,
      scaleMaxLabel,
    })
  }

  if (fields.length === 0) {
    throw new Error('This form appears to be empty.')
  }

  const actionUrl = extractActionUrl(formUrl)

  return {
    title: title as string,
    description,
    fields,
    actionUrl,
  }
}

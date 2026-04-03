export interface SubmitResult {
  success: boolean
  error?: string
}

export async function submitForm(
  actionUrl: string,
  answers: Record<string, string | string[]>
): Promise<SubmitResult> {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(answers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
    } else {
      params.append(key, value)
    }
  }

  try {
    const res = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: params.toString(),
      redirect: 'follow',
    })

    const text = await res.text()

    if (
      text.includes('Your response has been recorded') ||
      text.includes('freebirdFormviewerViewResponseConfirmationMessage') ||
      res.status === 200
    ) {
      return { success: true }
    }

    return { success: false, error: 'Submission did not return a confirmation.' }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during submission.',
    }
  }
}

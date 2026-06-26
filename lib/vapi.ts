const VAPI_BASE = 'https://api.vapi.ai'

async function vapiRequest(path: string, method: string, body?: object) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vapi ${method} ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

export async function transferCall(vapiCallId: string, toNumber: string) {
  return vapiRequest(`/call/${vapiCallId}/transfer`, 'POST', {
    destination: { type: 'number', number: toNumber },
  })
}

export async function sendVoicemailMessage(vapiCallId: string) {
  return vapiRequest(`/call/${vapiCallId}/message`, 'POST', {
    message: 'send_to_voicemail',
  })
}

import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  )
}

export function buildVapiTwiML(): string {
  const assistantId = process.env.VAPI_ASSISTANT_ID
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.vapi.ai/call/incoming?assistant_id=${assistantId}" />
  </Connect>
</Response>`
}

export function buildForwardTwiML(number: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${number}</Dial>
</Response>`
}

export async function sendSMSAlert(params: {
  callerName: string
  callerCompany: string
  callerReason: string
  callerPhone: string
  line: string
}) {
  const { callerName, callerCompany, callerReason, callerPhone, line } = params
  const dashboardUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const body = `📞 New call from ${callerName} (${callerCompany})
Reason: ${callerReason}
Their #: ${callerPhone}
Line: ${line}
→ Pick up or voicemail: ${dashboardUrl}`

  return twilioClient.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: process.env.OWNER_SMS_NUMBER ?? process.env.OWNER_FORWARD_NUMBER!,
  })
}

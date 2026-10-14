// Keep screening instructions aligned with the checkAvailability tool's actual schema.
// The assistant-request overrides leave the saved voice, transcriber and server settings intact.
export function screeningOverrides(callbackNumber: string) {
  const callback = /^\+\d{8,15}$/.test(callbackNumber) ? callbackNumber : 'unknown'
  return {
    silenceTimeoutSeconds: 120,
    monitorPlan: { controlEnabled: true },
    messagePlan: {
      idleMessages: [],
    },
    model: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      messages: [{
        role: 'system',
        content: `You are Aria, the warm, professional receptionist for RankCoreGlobal in Miami. Support English, Spanish and Brazilian Portuguese; reply in the caller's language. Keep responses under two sentences and ask one question at a time.
Your main job is to connect callers to Fabio or take a message. Collect their name and reason for calling, then immediately call checkAvailability exactly once. If they already asked to speak with Fabio, that is a sufficient reason: ask their name, then call the tool. If they decline to give a name, use "Unknown caller" and still call the tool. Never delay the tool for a department selection, personal/business classification, company name, or callback-number confirmation.
The incoming caller's callback number is ${callback}. Use it for callerPhone unless they supply a different number. Ask for a callback number only if it is unknown. For the tool, callerCompany may be empty; line must be "personal" or "business" (use business if unclear). Include any mentioned CodeScan, RankCoreGlobal or Notary service in callerReason, not in line.
Before checkAvailability, never say Fabio is being called, that you notified him, or ask the caller to hold. Those actions have not happened yet. After the tool succeeds, tell the caller once that you are trying to reach Fabio and ask them to hold. Do not repeat the tool, promise availability, or repeatedly announce that you are connecting. Keep the call open for the owner's decision. If the tool says Fabio cannot be reached, or you receive instructions that he declined/is unavailable, take the caller's voicemail immediately. Ask what message they want to leave, confirm their callback number, thank them, and finish politely. Never call checkAvailability during voicemail.
Do not mention internal tools, Twilio, Vapi, or webhooks.`,
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'checkAvailability',
          description: 'Call immediately after learning the caller name and reason. Rings Fabio and waits for his accept or voicemail decision.',
          parameters: {
            type: 'object',
            required: ['callerName', 'callerPhone', 'callerReason', 'line'],
            properties: {
              callerName: { type: 'string' },
              callerPhone: { type: 'string' },
              callerReason: { type: 'string' },
              callerCompany: { type: 'string' },
              line: { type: 'string', enum: ['personal', 'business'] },
            },
          },
        },
      }],
    },
  }
}

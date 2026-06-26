import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { updateCall } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { callId, transcript } = await req.json()
  if (!callId || !transcript) {
    return NextResponse.json({ error: 'callId and transcript required' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Analyze this call transcript and return a JSON object with these fields:
- intent: one short phrase describing why they called
- keyInfo: 2-3 bullet points of important details
- priority: "low" | "medium" | "high"
- suggestedAction: what the recipient should do next

Transcript:
${transcript}

Return only valid JSON, no markdown.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  let summary: object
  try {
    summary = JSON.parse(text)
  } catch {
    summary = { intent: 'Unknown', keyInfo: text, priority: 'low', suggestedAction: 'Review transcript' }
  }

  await updateCall(callId, { summary: JSON.stringify(summary) })
  return NextResponse.json(summary)
}

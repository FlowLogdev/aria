import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, notes, whatsapp } = body
  if (!name || !phone) return NextResponse.json({ error: 'name and phone required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({ name, phone, notes: notes ?? null, whatsapp: whatsapp ?? false })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

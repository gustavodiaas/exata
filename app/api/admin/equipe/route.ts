import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// O cliente "Administrador" criado com a Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { empresa_id } = await req.json()

    // O supabaseAdmin ignora qualquer política RLS
    // Ele busca tudo de qualquer empresa sem travas
    const { data, error } = await supabaseAdmin
      .from('controle_acesso')
      .select(`
        id, user_id, nivel, empresa_id,
        perfis:user_id (email, nome)
      `)
      .eq('empresa_id', empresa_id)

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

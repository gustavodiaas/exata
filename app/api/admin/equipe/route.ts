import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { empresa_id } = await req.json()

    // 1. Busca equipe
    const { data: equipe, error: equipeError } = await supabaseAdmin
      .from('controle_acesso')
      .select('*, perfis:user_id(email, nome)')
      .eq('empresa_id', empresa_id)

    if (equipeError) throw equipeError

    // 2. Garante que equipe é um array (se for null, vira [])
    const equipeData = equipe || []

    // 3. Busca permissões apenas se tiver usuários
    let permissoesData = []
    if (equipeData.length > 0) {
      const userIds = equipeData.map((u: any) => u.user_id)
      const { data: permData, error: permError } = await supabaseAdmin
        .from('permissoes')
        .select('*')
        .in('user_id', userIds)
      
      if (permError) throw permError
      permissoesData = permData || []
    }

    return NextResponse.json({ equipe: equipeData, permissoes: permissoesData })
    
  } catch (error: any) {
    // Retorna o erro real para facilitar o debug
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

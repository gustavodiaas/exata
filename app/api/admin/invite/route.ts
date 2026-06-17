import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, empresa, password, gerenteId, nivel } = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Cria o usuário
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    })
    if (authError) throw authError

    // 2. Cria o perfil vinculado ao gerente e nome da empresa
    const { error: profileError } = await supabaseAdmin.from('perfis').insert({
      id: authData.user.id,
      empresa: empresa,
      status: 'ativo',
      gerente_id: gerenteId // Vínculo de subordinação
    })
    if (profileError) throw profileError

    // 3. Define o nível de acesso (adm ou operador)
    const { error: accessError } = await supabaseAdmin.from('controle_acesso').insert({
      user_id: authData.user.id,
      nivel: nivel || 'operador'
    })
    if (accessError) throw accessError

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

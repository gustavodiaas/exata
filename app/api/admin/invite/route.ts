import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password, nivel, gerenteId, empresaNome } = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Descobre quem está emitindo o convite
    const { data: acessoInviter } = await supabaseAdmin
      .from('controle_acesso')
      .select('nivel')
      .eq('user_id', gerenteId)
      .single()

    const isMaster = acessoInviter?.nivel === 'master'

    // Cria a conta do novo usuário
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || 'Exata@123',
      email_confirm: true,
    })
    if (authError) throw authError

    let empresaIdFinal = null

    if (isMaster && nivel === 'admin') {
      // O Master está criando um cliente novo. Abre uma nova empresa no banco.
      const { data: novaEmpresa, error: empError } = await supabaseAdmin
        .from('empresas')
        .insert({ nome: empresaNome, status: 'ativo' })
        .select('id')
        .single()
      
      if (empError) throw empError
      empresaIdFinal = novaEmpresa.id
    } else {
      // O Cliente está criando um operador para a fábrica dele.
      const { data: adminPerfil } = await supabaseAdmin
        .from('perfis')
        .select('empresa_id')
        .eq('id', gerenteId)
        .single()
        
      empresaIdFinal = adminPerfil?.empresa_id
    }

    // Grava o perfil com a empresa correta
    const { error: perfilError } = await supabaseAdmin
      .from('perfis')
      .insert({
        id: authData.user.id,
        email,
        status: 'ativo',
        empresa_id: empresaIdFinal,
      })
    if (perfilError) throw perfilError

    // Define o cargo do novo usuário
    const { error: acessoError } = await supabaseAdmin
      .from('controle_acesso')
      .insert({
        user_id: authData.user.id,
        nivel: nivel || 'operador',
      })
    if (acessoError) throw acessoError

    return NextResponse.json({ success: true, user: authData.user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

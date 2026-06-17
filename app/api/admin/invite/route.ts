import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      nivel,
      gerenteId
    } = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Busca dados do gerente/admin que está criando o usuário
    const { data: gerentePerfil, error: gerenteError } = await supabaseAdmin
      .from('perfis')
      .select('empresa_id')
      .eq('id', gerenteId)
      .single()

    if (gerenteError || !gerentePerfil) {
      throw new Error('Empresa do administrador não encontrada.')
    }

    // Cria usuário no Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || 'Exata@123',
        email_confirm: true,
      })

    if (authError) throw authError

    // Cria perfil vinculado à MESMA empresa do admin
    const { error: perfilError } = await supabaseAdmin
      .from('perfis')
      .insert({
        id: authData.user.id,
        status: 'ativo',
        gerente_id: gerenteId,
        empresa_id: gerentePerfil.empresa_id,
      })

    if (perfilError) throw perfilError

    // Define nível de acesso
    const { error: acessoError } = await supabaseAdmin
      .from('controle_acesso')
      .insert({
        user_id: authData.user.id,
        nivel: nivel || 'operador',
      })

    if (acessoError) throw acessoError

    return NextResponse.json({
      success: true,
      user: authData.user,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}

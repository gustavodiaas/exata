import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, empresa, password } = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    })

    if (authError) throw authError

    const { error: profileError } = await supabaseAdmin.from('perfis').upsert({
      id: authData.user.id,
      empresa: empresa,
      status: 'ativo'
    })

    if (profileError) throw profileError

    const { error: accessError } = await supabaseAdmin.from('controle_acesso').insert({
      user_id: authData.user.id,
      nivel: 'admin'
    })

    if (accessError) throw accessError

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email;
    const nivel = body.nivel || 'operador';
    const empresa_id = body.empresa_id;

    if (!email || !empresa_id) {
      return NextResponse.json({ error: 'E-mail e ID da empresa são obrigatórios.' }, { status: 400 });
    }

    // Conexão de nível mestre com o Service Role Key para ignorar bloqueios
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Passo 1: Cria o usuário no Auth e dispara o e-mail oficial do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError) {
      // Se o usuário já existe no sistema (já foi convidado antes), o Supabase retorna erro.
      // Em um cenário avançado, você poderia apenas vincular o usuário existente à empresa aqui.
      throw authError;
    }

    // Passo 2: Cadastra as permissões do novo funcionário vinculadas à fábrica do chefe
    const { error: acessoError } = await supabaseAdmin
      .from('controle_acesso')
      .insert([{
        user_id: authData.user.id,
        nivel: nivel,
        empresa_id: empresa_id
      }]);

    if (acessoError) throw acessoError;

    return NextResponse.json({ success: true, message: 'Operador convidado e vinculado à fábrica com sucesso.' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

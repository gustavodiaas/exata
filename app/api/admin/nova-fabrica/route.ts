import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email;
    const nomeFabrica = body.nomeFabrica;

    // Conexão de nível mestre com o Service Role Key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Passo 1: Cria a fábrica no banco de dados
    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .insert([{ nome: nomeFabrica }])
      .select()
      .single();

    if (empresaError) throw empresaError;

    // Passo 2: Cria o usuário e dispara o e-mail de convite
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError) throw authError;

    // Passo 3: Define este novo usuário como o dono absoluto daquela fábrica
    const { error: acessoError } = await supabaseAdmin
      .from('controle_acesso')
      .insert([{
        user_id: authData.user.id,
        nivel: 'admin',
        empresa_id: empresa.id
      }]);

    if (acessoError) throw acessoError;

    return NextResponse.json({ success: true, message: 'Fábrica criada e convite formal enviado.' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

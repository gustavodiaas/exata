Exata | Gestão Industrial & PCP Inteligente

O Exata é uma plataforma moderna de Gerenciamento de Operações e Planejamento e Controle de Produção (PCP), desenvolvida para transformar a eficiência do chão de fábrica através de dados em tempo real e algoritmos de nivelamento de carga.

🚀 Visão Geral

Diferente dos sistemas legados, o Exata foca em uma interface minimalista e de alta performance, permitindo que gestores de produção visualizem gargalos, distribuam ordens de produção e monitorem indicadores de desempenho (KPIs) com precisão matemática.

Principais Módulos

Módulo
Descrição
Dashboard Operacional
Visão consolidada de OPs, taxas de refugo e produtividade por máquina.
PCP & Heijunka
Algoritmo de nivelamento de carga que distribui automaticamente a produção entre os postos de trabalho.
Produto & Roteiro (GBO)
Gestão de tempos e métodos, cálculo de Takt Time e definição de sequenciamento operacional.
Gestão de Ativos
Controle de máquinas, postos de trabalho e cronograma de manutenção preventiva/corretiva.
Apontamento
Registro simplificado da produção real para fechamento de ordens e análise de desvios.




🛠️ Stack Tecnológica

O sistema utiliza o que há de mais moderno no ecossistema de desenvolvimento web:

•
Framework: Next.js 15+ (App Router)

•
Linguagem: TypeScript

•
Estilização: Tailwind CSS 4

•
Banco de Dados & Auth: Supabase

•
Componentes UI: Radix UI & shadcn/ui

•
Gráficos: Recharts

⚙️ Configuração do Ambiente

Pré-requisitos

•
Node.js 20+

•
Conta no Supabase com as tabelas de perfis, maquinas, produtos, operacoes e ordens_producao configuradas.

Instalação

1.
Clone o repositório:

Bash


git clone https://github.com/seu-usuario/exata.git
cd exata





2.
Instale as dependências:

Bash


npm install





3.
Configure as variáveis de ambiente (.env.local ):

Plain Text


NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima





4.
Inicie o servidor de desenvolvimento:

Bash


npm run dev





📈 Roadmap de Evolução




Migração total para Server Actions para maior segurança de dados.




Implementação de notificações push para alertas de manutenção.




Módulo de análise preditiva de demanda baseado em histórico.




Integração direta com sensores IoT via Webhooks.




Desenvolvido com foco em precisão e clareza. Exata — A ciência da produção.


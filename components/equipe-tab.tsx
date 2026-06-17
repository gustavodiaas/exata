"use client"

import React, { useState, useEffect } from "react"
import { Users, Plus, Loader2 } from "lucide-react"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"

export function EquipeTab({ user }: { user: any }) {
  const [equipe, setEquipe] = useState<any[]>([])
  const [permissoes, setPermissoes] = useState<any[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const abasDisponiveis = ["gbo", "pcp", "apontamento", "maquinas", "manutencao"]

  const carregarDados = async () => {
    setIsLoading(true)
    try {
      const { data: adminPerfil, error: adminError } = await supabase
        .from("perfis")
        .select("empresa_id")
        .eq("id", user.id)
        .single()

      if (adminError) throw adminError

      if (adminPerfil && adminPerfil.empresa_id) {
        const { data: equipeData, error: equipeError } = await supabase
          .from("perfis")
          .select("*")
          .eq("empresa_id", adminPerfil.empresa_id)
          .neq("id", user.id)

        if (equipeError) throw equipeError

        if (equipeData && equipeData.length > 0) {
          const userIds = equipeData.map((m: any) => m.id)
          const { data: permData, error: permError } = await supabase
            .from("permissoes")
            .select("*")
            .in("user_id", userIds)

          if (permError) throw permError
          setPermissoes(permData || [])
        } else {
          setPermissoes([])
        }
        setEquipe(equipeData || [])
      } else {
        setEquipe([])
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { carregarDados() }, [user.id])

  const handleInvite = async () => {
    if (!email.trim()) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: "Exata@123",
          gerenteId: user.id,
          nivel: "operador"
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Falha ao convidar")
      }

      toast({ title: "Sucesso", description: "Funcionário cadastrado." })
      setEmail("")
      setIsAdding(false)
      carregarDados()
    } catch (error: any) {
      toast({ title: "Erro no convite", description: error.message, variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const togglePermissao = async (userId: string, aba: string) => {
    const temPermissao = permissoes.some((p: any) => p.user_id === userId && p.aba_id === aba)

    try {
      if (temPermissao) {
        await supabase.from("permissoes").delete().match({ user_id: userId, aba_id: aba })
      } else {
        await supabase.from("permissoes").insert({ user_id: userId, aba_id: aba })
      }
      carregarDados()
    } catch (error: any) {
      toast({ title: "Erro ao atualizar permissão", description: error.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipe
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os acessos dos seus operadores.</p>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all">
          <Plus className="h-4 w-4" /> Novo Membro
        </button>
      </div>

      {isAdding && (
        <div className="bg-card border border-border p-6 rounded-2xl space-y-4 max-w-md animate-in fade-in slide-in-from-top-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">E-mail do Operador</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operador@industria.com" className="w-full h-10 px-4 rounded-xl border border-border bg-input outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleInvite} disabled={isCreating} className="w-full h-10 flex items-center justify-center bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
             {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Convidando...</> : "Gerar Acesso (Senha: Exata@123)"}
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
              <tr>
                <th className="px-6 py-4">Usuário / E-mail</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Controle de Menus (Clique para alternar)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    Carregando equipe...
                  </td>
                </tr>
              ) : equipe.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    Nenhum operador cadastrado
                  </td>
                </tr>
              ) : (
                equipe.map((membro) => (
                  <tr key={membro.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{membro.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${membro.status === 'inativo' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                        {membro.status || "Ativo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {abasDisponiveis.map((aba) => {
                          const temPermissao = permissoes.some((p: any) => p.user_id === membro.id && p.aba_id === aba)
                          return (
                            <button
                              key={aba}
                              onClick={() => togglePermissao(membro.id, aba)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${temPermissao ? "bg-primary text-primary-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"}`}
                              title={temPermissao ? "Clique para revogar acesso" : "Clique para conceder acesso"}
                            >
                              {aba}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

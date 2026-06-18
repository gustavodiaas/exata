"use client"

import React, { useState, useEffect } from "react"
import { Users, Plus, Loader2, ShieldCheck, Mail, Building } from "lucide-react"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"

export function EquipeTab({ user }: { user: any }) {
  const [equipe, setEquipe] = useState<any[]>([])
  const [permissoes, setPermissoes] = useState<any[]>([])
  
  const [isMaster, setIsMaster] = useState(false)
  const [listaEmpresas, setListaEmpresas] = useState<any[]>([])
  const [empresaAtivaId, setEmpresaAtivaId] = useState<string | null>(null)
  
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const abasDisponiveis = ["gbo", "pcp", "apontamento", "maquinas", "manutencao"]

  // Passo 1: Descobre quem é o usuário e se ele tem o poder de Deus
  const inicializarAcesso = async () => {
    try {
      const { data: meuAcesso, error } = await supabase
        .from("controle_acesso")
        .select("nivel, empresa_id")
        .eq("user_id", user.id)
        .single()

      if (error) throw error

      if (meuAcesso.nivel === "master") {
        setIsMaster(true)
        const { data: empresas } = await supabase.from("empresas").select("*").order("nome")
        if (empresas) setListaEmpresas(empresas)
      }

      setEmpresaAtivaId(meuAcesso.empresa_id)
    } catch (error) {
      toast({ title: "Erro de Autenticação", description: "Não foi possível validar seu nível de acesso.", variant: "destructive" })
    }
  }

  // Passo 2: Carrega a equipe da fábrica selecionada
  const carregarEquipeDaFabrica = async (idEmpresa: string) => {
    setIsLoading(true)
    try {
      const { data: equipeData, error: equipeError } = await supabase
        .from("controle_acesso")
        .select("*, perfis(email, nome)")
        .eq("empresa_id", idEmpresa)
        .neq("user_id", user.id)

      if (equipeError) throw equipeError

      if (equipeData && equipeData.length > 0) {
        const userIds = equipeData.map((m: any) => m.user_id)
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
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível carregar a equipe desta unidade.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) inicializarAcesso()
  }, [user])

  useEffect(() => {
    if (empresaAtivaId) carregarEquipeDaFabrica(empresaAtivaId)
  }, [empresaAtivaId])

  const handleInvite = async () => {
    if (!email.trim() || !empresaAtivaId) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/equipe/convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          nivel: "operador",
          empresa_id: empresaAtivaId
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Falha ao convidar")
      }

      toast({ title: "Sucesso", description: "Convite formal enviado por e-mail." })
      setEmail("")
      setIsAdding(false)
      carregarEquipeDaFabrica(empresaAtivaId)
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
      if (empresaAtivaId) carregarEquipeDaFabrica(empresaAtivaId)
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao atualizar permissão.", variant: "destructive" })
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
          <p className="text-sm text-muted-foreground mt-1">Gerencie os acessos dos operadores.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Seletor Master de Empresas */}
          {isMaster && (
            <div className="flex items-center bg-muted/30 px-3 py-1 rounded-xl border border-border">
              <Building className="h-4 w-4 text-primary mr-2" />
              <select 
                value={empresaAtivaId || ""}
                onChange={(e) => setEmpresaAtivaId(e.target.value)}
                className="bg-transparent text-xs font-bold uppercase tracking-widest text-foreground outline-none cursor-pointer"
              >
                {listaEmpresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>
          )}

          <button onClick={() => setIsAdding(!isAdding)} className="bg-primary text-primary-foreground px-4 h-10 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all shadow-md">
            {isAdding ? "Cancelar" : <><Plus className="h-4 w-4" /> Novo Membro</>}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-card border border-border p-6 rounded-2xl space-y-4 max-w-md animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">E-mail do Operador</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operador@industria.com" className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-input outline-none focus:ring-2 focus:ring-primary text-sm transition-all" />
            </div>
          </div>
          <button onClick={handleInvite} disabled={isCreating || !empresaAtivaId} className="w-full h-11 flex items-center justify-center bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md disabled:opacity-50">
             {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Convidando...</> : "Disparar Convite Oficial"}
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
                    Carregando equipe da unidade...
                  </td>
                </tr>
              ) : equipe.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    Nenhum operador cadastrado nesta fábrica
                  </td>
                </tr>
              ) : (
                equipe.map((membro) => {
                  const isPrivilegiado = membro.nivel === "master" || membro.nivel === "admin"

                  return (
                    <tr key={membro.id} className="hover:bg-muted/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">
                        {membro.perfis?.email || "Convite Pendente"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500">
                          Ativo
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isPrivilegiado ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 w-fit">
                            <ShieldCheck className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              Acesso Total ({membro.nivel})
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {abasDisponiveis.map((aba) => {
                              const temPermissao = permissoes.some((p: any) => p.user_id === membro.user_id && p.aba_id === aba)
                              return (
                                <button
                                  key={aba}
                                  onClick={() => togglePermissao(membro.user_id, aba)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${temPermissao ? "bg-primary text-primary-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"}`}
                                  title={temPermissao ? "Clique para revogar acesso" : "Clique para conceder acesso"}
                                >
                                  {aba}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

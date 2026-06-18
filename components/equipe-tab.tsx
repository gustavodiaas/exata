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
      toast({ title: "Erro", description: "Não foi possível validar seu nível de acesso.", variant: "destructive" })
    }
  }

  // AGORA BUSCA VIA API PARA BURLAR O RLS NO BANCO
  const carregarEquipeDaFabrica = async (idEmpresa: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/equipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: idEmpresa })
      })

      if (!res.ok) throw new Error("Erro na comunicação com a API Admin")
      
      const { equipe, permissoes } = await res.json()

      const equipeFormatada = equipe
        .filter((m: any) => m.user_id !== user.id)
        .map((m: any) => ({
          ...m,
          perfis: m.perfis || { email: "Usuário sem perfil" }
        }))

      setEquipe(equipeFormatada)
      setPermissoes(permissoes || [])

    } catch (error: any) {
      console.error(error)
      toast({ title: "Erro", description: "Falha ao carregar equipe.", variant: "destructive" })
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

      if (!res.ok) throw new Error("Falha ao convidar")

      toast({ title: "Sucesso", description: "Convite enviado." })
      setEmail("")
      setIsAdding(false)
      carregarEquipeDaFabrica(empresaAtivaId)
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" })
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
            <Users className="h-6 w-6 text-primary" /> Equipe
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
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
        <div className="bg-card border border-border p-6 rounded-2xl space-y-4 max-w-md">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operador@industria.com" className="w-full h-11 px-4 rounded-xl border border-border bg-input" />
          <button onClick={handleInvite} className="w-full h-11 bg-foreground text-background font-bold text-xs uppercase rounded-xl">Disparar Convite</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            <tr>
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Permissões</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? <tr><td colSpan={3} className="px-6 py-8 text-center text-xs text-muted-foreground">Carregando...</td></tr> : 
             equipe.length === 0 ? <tr><td colSpan={3} className="px-6 py-8 text-center text-xs text-muted-foreground">Nenhum operador</td></tr> :
             equipe.map((membro) => (
               <tr key={membro.id}>
                 <td className="px-6 py-4 font-bold">{membro.perfis?.email}</td>
                 <td className="px-6 py-4 text-green-500 font-bold text-[10px] uppercase">Ativo</td>
                 <td className="px-6 py-4">
                    {membro.nivel === 'admin' ? "Acesso Total" : 
                      <div className="flex gap-2">
                        {abasDisponiveis.map(aba => (
                          <button key={aba} onClick={() => togglePermissao(membro.user_id, aba)} className={`px-2 py-1 rounded text-[10px] ${permissoes.some(p => p.user_id === membro.user_id && p.aba_id === aba) ? "bg-primary text-white" : "bg-muted"}`}>
                            {aba}
                          </button>
                        ))}
                      </div>
                    }
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

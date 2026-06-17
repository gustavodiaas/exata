"use client"

import React, { useState, useEffect } from "react"
import { Users, Plus, Trash2, Loader2, Key } from "lucide-react"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"

export function EquipeTab({ user }: { user: any }) {
  const [equipe, setEquipe] = useState<any[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const carregarEquipe = async () => {
    setIsLoading(true)
    const { data } = await supabase.from("perfis").select("*, controle_acesso(nivel)").eq("gerente_id", user.id)
    setEquipe(data || [])
    setIsLoading(false)
  }

  useEffect(() => { carregarEquipe() }, [])

  const handleInvite = async () => {
    setIsCreating(true)
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, empresa: "Membro de Equipe", password: "Exata@123", gerenteId: user.id, nivel: "operador" })
    })
    if (res.ok) {
      toast({ title: "Sucesso", description: "Funcionário cadastrado." })
      carregarEquipe()
    }
    setIsCreating(false)
  }

  const togglePermissao = async (userId: string, aba: string, temPermissao: boolean) => {
    if (temPermissao) {
      await supabase.from("permissoes").delete().match({ user_id: userId, aba_id: aba })
    } else {
      await supabase.from("permissoes").insert({ user_id: userId, aba_id: aba })
    }
    carregarEquipe()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tight">Equipe</h2>
        <button onClick={() => setIsAdding(!isAdding)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Membro
        </button>
      </div>

      {isAdding && (
        <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
          <input type="email" placeholder="E-mail do funcionário" onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-border bg-input" />
          <button onClick={handleInvite} disabled={isCreating} className="w-full h-10 bg-foreground text-background font-bold rounded-xl">
             {isCreating ? "Criando..." : "Convidar Funcionário"}
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
            <tr>
              <th className="px-6 py-3">E-mail</th>
              <th className="px-6 py-3">Acessos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {equipe.map((membro) => (
              <tr key={membro.id}>
                <td className="px-6 py-4 font-bold">{membro.email}</td>
                <td className="px-6 py-4 space-x-2">
                  {["pcp", "apontamento"].map((aba) => (
                    <button key={aba} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${equipe.some(p => p.aba_id === aba) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => togglePermissao(membro.id, aba, false)}>
                      {aba}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

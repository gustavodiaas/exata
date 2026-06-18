"use client"

import React, { useState, useEffect } from "react"
import { Users, Plus, Building, UserCheck } from "lucide-react"
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
  const { toast } = useToast()

  const abasDisponiveis = ["gbo", "pcp", "apontamento", "maquinas", "manutencao"]

  const carregarDadosMaster = async () => {
    const { data: perfil } = await supabase.from("perfis").select("tipo_usuario, empresa_id").eq("id", user.id).single()
    
    if (perfil?.tipo_usuario === "master") {
      setIsMaster(true)
      const { data: empresas } = await supabase.from("empresas").select("*").order("nome")
      setListaEmpresas(empresas || [])
      setEmpresaAtivaId(empresas?.[0]?.id || null)
    } else {
      setEmpresaAtivaId(perfil?.empresa_id || null)
    }
  }

  const carregarEquipe = async () => {
    if (!empresaAtivaId) return
    setIsLoading(true)

    // Consulta direta ao banco, o RLS filtra automaticamente para você
    const { data: mem } = await supabase.from("perfis").select("*").eq("empresa_id", empresaAtivaId)
    const { data: perm } = await supabase.from("permissoes").select("*").eq("empresa_id", empresaAtivaId)

    setEquipe(mem || [])
    setPermissoes(perm || [])
    setIsLoading(false)
  }

  useEffect(() => { carregarDadosMaster() }, [])
  useEffect(() => { 
  console.log("Empresa Ativa ID:", empresaAtivaId);
  carregarEquipe(); 
}, [empresaAtivaId]);

  const togglePermissao = async (userId: string, aba: string) => {
    const existing = permissoes.find(p => p.user_id === userId && p.aba_id === aba)
    
    if (existing) {
      await supabase.from("permissoes").delete().eq("id", existing.id)
    } else {
      await supabase.from("permissoes").insert({ user_id: userId, aba_id: aba, empresa_id: empresaAtivaId })
    }
    carregarEquipe()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Equipe</h2>
        
        {isMaster && (
          <div className="flex items-center bg-muted/30 px-4 py-2 rounded-xl border">
            <Building className="h-4 w-4 mr-2 text-primary" />
            <select value={empresaAtivaId || ""} onChange={(e) => setEmpresaAtivaId(e.target.value)} className="bg-transparent text-xs font-bold uppercase outline-none">
              {listaEmpresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Permissões</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {equipe.map((membro) => (
              <tr key={membro.id}>
                <td className="px-6 py-4 font-bold">{membro.email}</td>
                <td className="px-6 py-4 flex gap-2">
                  {abasDisponiveis.map(aba => (
                    <button key={aba} onClick={() => togglePermissao(membro.id, aba)} 
                      className={`px-3 py-1 rounded-md text-[10px] font-bold ${permissoes.some(p => p.user_id === membro.id && p.aba_id === aba) ? "bg-primary text-white" : "bg-muted"}`}>
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

"use client"

import React, { useState, useEffect } from "react"
import { ShieldAlert, Users, Plus, Building2, Mail, Power, RefreshCw, Loader2 } from "lucide-react"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"

export function MasterTab() {
  const [isAdding, setIsAdding] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [novaEmpresa, setNovaEmpresa] = useState("")
  const [novoEmail, setNovoEmail] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const { toast } = useToast()

  const carregarClientes = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("perfis")
        .select("*, controle_acesso(nivel)")
        .order("empresa", { ascending: true })

      if (error) throw error
      setClientes(data || [])
    } catch (error: any) {
      toast({ title: "Erro de conexão", description: "Não foi possível carregar as fábricas.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    carregarClientes()
  }, [])

  const toggleStatus = async (id: string, currentStatus: string) => {
    const novoStatus = currentStatus === "inativo" ? "ativo" : "inativo"
    try {
      const { error } = await supabase
        .from("perfis")
        .update({ status: novoStatus })
        .eq("id", id)

      if (error) throw error
      
      toast({ title: "Comando executado", description: `O acesso da fábrica foi alterado para ${novoStatus.toUpperCase()}.` })
      carregarClientes()
    } catch (error: any) {
      toast({ title: "Falha na execução", description: error.message, variant: "destructive" })
    }
  }

  const handleCriarConvite = async () => {
    if (!novaEmpresa.trim() || !novoEmail.trim()) {
      toast({ title: "Dados incompletos", description: "Preencha o nome da empresa e o e-mail.", variant: "destructive" })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: novoEmail.trim(), 
          empresa: novaEmpresa.trim(), 
          password: 'Exata@123' 
        })
      })

      const result = await response.json()
      
      if (!response.ok) throw new Error(result.error || "Erro desconhecido ao criar acesso.")

      toast({ title: "Fábrica Operacional", description: "Acesso gerado com sucesso. Senha padrão: Exata@123" })
      setNovaEmpresa("")
      setNovoEmail("")
      setIsAdding(false)
      carregarClientes()
    } catch (error: any) {
      toast({ title: "Falha ao credenciar", description: error.message, variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }
const toggleAdminStatus = async (userId: string, isCurrentlyAdmin: boolean) => {
  try {
    if (isCurrentlyAdmin) {
      await supabase.from("controle_acesso").delete().eq("user_id", userId)
      toast({ title: "Acesso removido", description: "O usuário não é mais administrador." })
    } else {
      await supabase.from("controle_acesso").upsert({ user_id: userId, nivel: "admin" })
      toast({ title: "Acesso concedido", description: "O usuário agora é administrador." })
    }
    carregarClientes()
  } catch (error: any) {
    toast({ title: "Erro", description: error.message, variant: "destructive" })
  }
}
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Painel Master
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gestão absoluta de clientes, assinaturas e níveis de acesso.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarClientes} className="h-10 w-10 flex items-center justify-center bg-muted text-foreground rounded-xl shadow-sm hover:opacity-90 transition-all" title="Atualizar lista">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="h-10 px-4 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-md hover:opacity-90 transition-all"
          >
            {isAdding ? "Cancelar" : <><Plus className="h-4 w-4" /> Novo Cliente</>}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Credenciar Nova Fábrica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome da Empresa</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={novaEmpresa}
                  onChange={(e) => setNovaEmpresa(e.target.value)}
                  placeholder="Indústria Exemplo Ltda" 
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">E-mail do Administrador</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="email" 
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder="admin@industria.com" 
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                />
              </div>
            </div>
          </div>
          <button 
            onClick={handleCriarConvite}
            disabled={isCreating}
            className="mt-4 h-10 w-full flex items-center justify-center bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando Acesso...</> : "Gerar Convite de Acesso"}
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Fábricas Operando</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded-md">
            {clientes.length} {clientes.length === 1 ? 'Registro' : 'Registros'}
          </span>
        </div>
        
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                <tr>
                  <th className="px-6 py-3">Empresa</th>
                  <th className="px-6 py-3">ID de Registro</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <th className="px-6 py-3 text-center">Admin</th>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
                      Buscando banco de dados...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-xs text-muted-foreground font-bold uppercase tracking-widest">
                      Nenhuma fábrica encontrada
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{cliente.empresa || "Sem nome definido"}</td>
                      <td className="px-6 py-4 text-muted-foreground text-[11px] font-mono">{cliente.id}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${cliente.status === 'inativo' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                          {cliente.status || "Ativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => toggleStatus(cliente.id, cliente.status)}
                          className={`p-2 rounded-lg transition-colors ${cliente.status === 'inativo' ? 'text-green-500 hover:bg-green-500/10' : 'text-destructive hover:bg-destructive/10'}`} 
                          title={cliente.status === 'inativo' ? 'Reativar Acesso' : 'Suspender Acesso'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              // Onde "cliente" é a variável do seu .map()
<td className="px-6 py-4 text-center">
  <button 
    onClick={() => toggleAdminStatus(cliente.id, cliente.controle_acesso?.length > 0)}
    className={`p-2 rounded-lg transition-colors ${cliente.controle_acesso?.length > 0 ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'}`}
    title={cliente.controle_acesso?.length > 0 ? "Remover status de Admin" : "Tornar Admin"}
  >
    <ShieldAlert className="h-4 w-4" />
  </button>
</td>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

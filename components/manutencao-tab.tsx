"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"
import { Plus, Wrench, CheckCircle2, Clock, AlertTriangle, Trash2, Calendar } from "lucide-react"
import { DatePicker } from "@/components/date-picker"

interface Manutencao {
  id: string
  maquina_id: string
  maquina_nome: string
  maquina_codigo?: string
  tipo: "preventiva" | "corretiva"
  status: "pendente" | "em_execucao" | "concluida"
  data_programada: string
  descricao: string
}

export function ManutencaoTab({ user }: { user: any }) {
  const { toast } = useToast()
  const [registros, setRegistros] = useState<Manutencao[]>([])
  const [maquinas, setMaquinas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [maquinaId, setMaquinaId] = useState("")
  const [tipo, setTipo] = useState<"preventiva" | "corretiva">("preventiva")
  const [data, setData] = useState("")
  const [descricao, setDescricao] = useState("")

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      const [maq, man] = await Promise.all([
        supabase.from("maquinas").select("id, nome, codigo").eq("user_id", user.id),
        supabase.from("manutencao").select("*, maquinas(nome, codigo)").eq("user_id", user.id).order("data_programada", { ascending: true })
      ])

      setMaquinas(maq.data || [])
      setRegistros((man.data || []).map((m: any) => ({ 
        ...m, 
        maquina_nome: m.maquinas?.nome,
        maquina_codigo: m.maquinas?.codigo
      })))
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao carregar dados.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSalvar = async () => {
    if (!maquinaId || !data || !descricao) {
      toast({ title: "Dados incompletos", description: "Preencha máquina, data e descrição.", variant: "destructive" })
      return
    }

    const { error } = await supabase.from("manutencao").insert([{
      user_id: user.id,
      maquina_id: maquinaId,
      tipo,
      data_programada: data,
      descricao,
      status: "pendente"
    }])

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" })
      return
    }

    toast({ title: "✅ Agendado", description: "Manutenção registrada com sucesso." })
    loadData()
    setDescricao("")
  }

  const handleStatusChange = async (id: string, novoStatus: string) => {
    const { error } = await supabase.from("manutencao").update({ status: novoStatus }).eq("id", id)
    if (!error) loadData()
  }

  const handleExcluir = async (id: string) => {
    const { error } = await supabase.from("manutencao").delete().eq("id", id)
    if (!error) loadData()
  }

  return (
    <div className="flex flex-col xl:flex-row gap-8 pb-12">
      <div className="xl:w-[35%] bg-card p-6 rounded-2xl border border-border shadow-sm space-y-5 h-fit">
        <h3 className="font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
          <Wrench className="h-4 w-4 text-primary" /> Nova Manutenção
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Máquina</label>
            <select value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-border bg-input text-foreground text-sm outline-none">
              <option value="">Selecione o equipamento</option>
              {maquinas.map(m => <option key={m.id} value={m.id}>{m.codigo} - {m.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipo("preventiva")} className={`h-10 rounded-xl text-xs font-bold border ${tipo === "preventiva" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Preventiva</button>
              <button onClick={() => setTipo("corretiva")} className={`h-10 rounded-xl text-xs font-bold border ${tipo === "corretiva" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Corretiva</button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Data Programada</label>
            <DatePicker value={data} onChange={setData} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none" placeholder="Motivo da manutenção" />
          </div>
          <button onClick={handleSalvar} className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase shadow-md">Agendar</button>
        </div>
      </div>

      <div className="xl:w-[65%] bg-card rounded-3xl border border-border p-6 shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-6">Agenda de Manutenção</h3>
        <div className="space-y-3">
          {registros.map(m => (
            <div key={m.id} className="p-4 border border-border rounded-2xl flex items-center justify-between gap-4">
              <div className="flex gap-4 items-center">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${m.status === "concluida" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}>
                  {m.tipo === "preventiva" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{m.maquina_codigo}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{m.maquina_nome} · {m.descricao} · {m.data_programada.split("-").reverse().join("/")}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <select value={m.status} onChange={(e) => handleStatusChange(m.id, e.target.value)} className="h-9 px-3 rounded-lg border border-border text-xs bg-input">
                  <option value="pendente">Pendente</option>
                  <option value="em_execucao">Em execução</option>
                  <option value="concluida">Concluída</option>
                </select>
                <button onClick={() => handleExcluir(m.id)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/components/supabase"
import { Plus, Trash2, ClipboardList, TrendingUp, AlertTriangle, CheckCircle2, Clock, Package } from "lucide-react"
import { DatePicker } from "@/components/date-picker"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OrdemProducao {
  id: string
  opNumber: string
  date: string
  productCode: string
  quantity: number
  calculationRule: "soma" | "media" | "gargalo"
}

interface Apontamento {
  id: string
  ordemId: string
  dataApontamento: string
  horaInicio: string
  horaFim: string
  pecasProduzidas: number
  pecasRefugo: number
  pecasRetrabalho: number
  observacao: string
}

interface ResumoOP {
  op: OrdemProducao
  apontamentos: Apontamento[]
  totalProduzidas: number
  totalRefugo: number
  totalRetrabalho: number
  percentualConclusao: number
  fechada: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularTempoDecorrido(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(":").map(Number)
  const [hf, mf] = fim.split(":").map(Number)
  return Math.max(0, (hf * 60 + mf) - (hi * 60 + mi))
}

function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

function badgeStatus(pct: number) {
  if (pct >= 100) return { label: "Concluída", classes: "bg-green-500/10 text-green-600 border border-green-500/20" }
  if (pct >= 50) return { label: "Em andamento", classes: "bg-primary/10 text-primary border border-primary/20" }
  return { label: "Iniciada", classes: "bg-amber-500/10 text-amber-600 border border-amber-500/20" }
}

function formatTimeMask(value: string): string {
  let v = value.replace(/\D/g, "")
  if (v.length > 4) v = v.slice(0, 4)
  if (v.length >= 3) return `${v.slice(0, 2)}:${v.slice(2)}`
  return v
}

function isValidTime(value: string): boolean {
  if (!value) return true
  if (value.length !== 5) return false
  const [h, m] = value.split(":").map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ApontamentoTab() {
  const { toast } = useToast()

  const [ordens, setOrdens] = useState<OrdemProducao[]>([])
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [loading, setLoading] = useState(true)

  // Formulário
  const [ordemSelecionada, setOrdemSelecionada] = useState("")
  const [dataApontamento, setDataApontamento] = useState("")
  const [horaInicio, setHoraInicio] = useState("")
  const [horaFim, setHoraFim] = useState("")
  const [pecasProduzidas, setPecasProduzidas] = useState("")
  const [pecasRefugo, setPecasRefugo] = useState("")
  const [pecasRetrabalho, setPecasRetrabalho] = useState("")
  const [observacao, setObservacao] = useState("")
  const [salvando, setSalvando] = useState(false)

  // Filtro de OP selecionada no painel de resumo
  const [opExpandida, setOpExpandida] = useState<string | null>(null)

  // ─── Carga de dados ──────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return

      const { data: opsData } = await supabase
        .from("ordens_producao")
        .select("*")
        .eq("user_id", userId)
        .order("data_programacao", { ascending: true })

      const formattedOrdens: OrdemProducao[] = (opsData || []).map((op: any) => ({
        id: op.id,
        opNumber: op.numero_op,
        date: op.data_programacao,
        productCode: op.produto_codigo,
        quantity: op.quantidade,
        calculationRule: op.regra_calculo,
      }))
      setOrdens(formattedOrdens)

      const { data: apData } = await supabase
        .from("apontamentos")
        .select("*")
        .eq("user_id", userId)
        .order("data_apontamento", { ascending: false })

      const formattedAp: Apontamento[] = (apData || []).map((a: any) => ({
        id: a.id,
        ordemId: a.ordem_id,
        dataApontamento: a.data_apontamento,
        horaInicio: a.hora_inicio,
        horaFim: a.hora_fim,
        pecasProduzidas: a.pecas_produzidas,
        pecasRefugo: a.pecas_refugo,
        pecasRetrabalho: a.pecas_retrabalho,
        observacao: a.observacao || "",
      }))
      setApontamentos(formattedAp)
    } catch (e) {
      console.error("Erro ao carregar apontamentos:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ─── Resumo por OP ───────────────────────────────────────────────────────────

  const resumos: ResumoOP[] = useMemo(() => {
    return ordens.map((op) => {
      const aps = apontamentos.filter((a) => a.ordemId === op.id)
      const totalProduzidas = aps.reduce((s, a) => s + a.pecasProduzidas, 0)
      const totalRefugo = aps.reduce((s, a) => s + a.pecasRefugo, 0)
      const totalRetrabalho = aps.reduce((s, a) => s + a.pecasRetrabalho, 0)
      const percentualConclusao = op.quantity > 0 ? Math.min(100, (totalProduzidas / op.quantity) * 100) : 0
      return {
        op,
        apontamentos: aps,
        totalProduzidas,
        totalRefugo,
        totalRetrabalho,
        percentualConclusao,
        fechada: totalProduzidas >= op.quantity,
      }
    })
  }, [ordens, apontamentos])

  // ─── Salvar apontamento ──────────────────────────────────────────────────────

  const handleTimeBlur = (value: string, setter: (val: string) => void) => {
    if (value && !isValidTime(value)) {
      setter("")
      toast({ title: "Horário inválido", description: "Use o formato correto (00:00 a 23:59).", variant: "destructive" })
    }
  }

  const handleSalvar = async () => {
    if (!ordemSelecionada || !dataApontamento || !horaInicio || !horaFim || !pecasProduzidas) {
      toast({ title: "Campos obrigatórios", description: "Preencha OP, data, horários e peças produzidas.", variant: "destructive" })
      return
    }

    if (!isValidTime(horaInicio) || !isValidTime(horaFim)) {
      toast({ title: "Horário inválido", description: "Verifique se os horários de início e fim estão corretos.", variant: "destructive" })
      return
    }

    const inicio = horaInicio
    const fim = horaFim
    const tempoDecorrido = calcularTempoDecorrido(inicio, fim)

    if (tempoDecorrido <= 0) {
      toast({ title: "Horário inválido", description: "A hora de fim deve ser posterior à hora de início.", variant: "destructive" })
      return
    }

    const produzidas = parseInt(pecasProduzidas) || 0
    const refugo = parseInt(pecasRefugo) || 0
    const retrabalho = parseInt(pecasRetrabalho) || 0

    if (produzidas <= 0) {
      toast({ title: "Quantidade inválida", description: "Peças produzidas deve ser maior que zero.", variant: "destructive" })
      return
    }

    // Verifica se OP já está fechada
    const resumoOp = resumos.find((r) => r.op.id === ordemSelecionada)
    if (resumoOp?.fechada) {
      toast({ title: "OP já concluída", description: "Esta ordem já atingiu a quantidade total planejada.", variant: "destructive" })
      return
    }

    setSalvando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return

      const payload = {
        user_id: userId,
        ordem_id: ordemSelecionada,
        data_apontamento: dataApontamento,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        pecas_produzidas: produzidas,
        pecas_refugo: refugo,
        pecas_retrabalho: retrabalho,
        observacao: observacao.trim() || null,
      }

      const { data, error } = await supabase.from("apontamentos").insert([payload]).select()

      if (error) throw error

      if (data && data[0]) {
        const novoAp: Apontamento = {
          id: data[0].id,
          ordemId: data[0].ordem_id,
          dataApontamento: data[0].data_apontamento,
          horaInicio: data[0].hora_inicio,
          horaFim: data[0].hora_fim,
          pecasProduzidas: data[0].pecas_produzidas,
          pecasRefugo: data[0].pecas_refugo,
          pecasRetrabalho: data[0].pecas_retrabalho,
          observacao: data[0].observacao || "",
        }
        setApontamentos((prev) => [novoAp, ...prev])
        setOpExpandida(ordemSelecionada)
      }

      // Limpa formulário
      setPecasProduzidas("")
      setPecasRefugo("")
      setPecasRetrabalho("")
      setObservacao("")
      setHoraInicio("")
      setHoraFim("")

      toast({ title: "✅ Apontamento registrado", description: "Produção sincronizada com sucesso." })
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" })
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluirApontamento = async (id: string) => {
    const { error } = await supabase.from("apontamentos").delete().eq("id", id)
    if (!error) {
      setApontamentos((prev) => prev.filter((a) => a.id !== id))
      toast({ title: "Apontamento removido", description: "Registro excluído com sucesso." })
    }
  }

  // ─── KPIs globais ────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalOPs = ordens.length
    const opsFechadas = resumos.filter((r) => r.fechada).length
    const totalProduzidas = apontamentos.reduce((s, a) => s + a.pecasProduzidas, 0)
    const totalRefugo = apontamentos.reduce((s, a) => s + a.pecasRefugo, 0)
    const pctRefugo = totalProduzidas + totalRefugo > 0
      ? ((totalRefugo / (totalProduzidas + totalRefugo)) * 100).toFixed(1)
      : "0.0"
    return { totalOPs, opsFechadas, totalProduzidas, totalRefugo, pctRefugo }
  }, [resumos, apontamentos, ordens])

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-widest animate-pulse">
        Carregando apontamentos...
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "OPs na carteira", value: kpis.totalOPs, icon: ClipboardList, color: "text-primary" },
          { label: "OPs concluídas", value: kpis.opsFechadas, icon: CheckCircle2, color: "text-green-600" },
          { label: "Peças produzidas", value: kpis.totalProduzidas.toLocaleString("pt-BR"), icon: Package, color: "text-primary" },
          { label: "Taxa de refugo", value: `${kpis.pctRefugo}%`, icon: AlertTriangle, color: Number(kpis.pctRefugo) > 5 ? "text-destructive" : "text-amber-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted flex-shrink-0">
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">

        {/* Formulário de apontamento */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Registrar Apontamento</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Informe o que foi produzido no turno</p>
          </div>
          <div className="p-6 space-y-4">

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Ordem de Produção</Label>
              <Select value={ordemSelecionada} onValueChange={setOrdemSelecionada}>
                <SelectTrigger className="bg-input border-border h-10 text-sm">
                  <SelectValue placeholder="Selecione a OP" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {ordens.length === 0 && (
                    <SelectItem value="none" disabled>Nenhuma OP na carteira</SelectItem>
                  )}
                  {ordens.map((op) => {
                    const resumo = resumos.find((r) => r.op.id === op.id)
                    return (
                      <SelectItem key={op.id} value={op.id} disabled={resumo?.fechada}>
                        {op.opNumber} — {op.productCode}
                        {resumo?.fechada ? " ✓" : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Data do Apontamento</Label>
              <DatePicker value={dataApontamento} onChange={setDataApontamento} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Início</Label>
                <Input 
                  type="text" 
                  placeholder="00:00" 
                  maxLength={5}
                  value={horaInicio} 
                  onChange={(e) => setHoraInicio(formatTimeMask(e.target.value))} 
                  onBlur={(e) => handleTimeBlur(e.target.value, setHoraInicio)}
                  className="bg-input border-border h-10 text-sm font-medium" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fim</Label>
                <Input 
                  type="text" 
                  placeholder="00:00" 
                  maxLength={5}
                  value={horaFim} 
                  onChange={(e) => setHoraFim(formatTimeMask(e.target.value))} 
                  onBlur={(e) => handleTimeBlur(e.target.value, setHoraFim)}
                  className="bg-input border-border h-10 text-sm font-medium" 
                />
              </div>
            </div>

            {horaInicio.length === 5 && horaFim.length === 5 && calcularTempoDecorrido(horaInicio, horaFim) > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-xs text-primary font-bold">
                  {formatarMinutos(calcularTempoDecorrido(horaInicio, horaFim))} de produção
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Peças produzidas</Label>
              <Input type="number" min="1" placeholder="Ex: 120" value={pecasProduzidas} onChange={(e) => setPecasProduzidas(e.target.value)} className="bg-input border-border h-10 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Refugo</Label>
                <Input type="number" min="0" placeholder="0" value={pecasRefugo} onChange={(e) => setPecasRefugo(e.target.value)} className="bg-input border-border h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Retrabalho</Label>
                <Input type="number" min="0" placeholder="0" value={pecasRetrabalho} onChange={(e) => setPecasRetrabalho(e.target.value)} className="bg-input border-border h-10 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Observação (opcional)</Label>
              <Input placeholder="Ex: Parada por falta de material" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="bg-input border-border h-10 text-sm" />
            </div>

            <Button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full h-11 font-bold uppercase tracking-widest bg-primary hover:opacity-90 text-primary-foreground rounded-xl shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              {salvando ? "Registrando..." : "Registrar Apontamento"}
            </Button>
          </div>
        </div>

        {/* Painel de OPs com progresso */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Acompanhamento de OPs
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Planejado x realizado por ordem de produção</p>
              </div>
            </div>

            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {resumos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <ClipboardList className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Nenhuma OP na carteira</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie ordens de produção no módulo PCP para começar a apontar.</p>
                </div>
              )}

              {resumos.map((resumo) => {
                const badge = badgeStatus(resumo.percentualConclusao)
                const expandida = opExpandida === resumo.op.id
                const tempoTotal = resumo.apontamentos.reduce(
                  (s, a) => s + calcularTempoDecorrido(a.horaInicio, a.horaFim), 0
                )

                return (
                  <div key={resumo.op.id} className="p-5">
                    {/* Cabeçalho da OP */}
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setOpExpandida(expandida ? null : resumo.op.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{resumo.op.opNumber}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">{resumo.op.productCode}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.classes}`}>{badge.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Meta: <strong className="text-foreground">{resumo.op.quantity} peças</strong>
                          {" · "}Programada: <strong className="text-foreground">{resumo.op.date.split("-").reverse().join("/")}</strong>
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-xl font-bold text-foreground">{resumo.percentualConclusao.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">{resumo.totalProduzidas}/{resumo.op.quantity} pç</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${resumo.fechada ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${resumo.percentualConclusao}%` }}
                      />
                    </div>

                    {/* Métricas rápidas */}
                    <div className="mt-3 flex gap-4 text-[11px]">
                      {tempoTotal > 0 && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatarMinutos(tempoTotal)}
                        </span>
                      )}
                      {resumo.totalRefugo > 0 && (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {resumo.totalRefugo} refugo
                        </span>
                      )}
                      {resumo.totalRetrabalho > 0 && (
                        <span className="text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {resumo.totalRetrabalho} retrabalho
                        </span>
                      )}
                      {resumo.apontamentos.length > 0 && (
                        <span className="text-muted-foreground">{resumo.apontamentos.length} apontamento{resumo.apontamentos.length > 1 ? "s" : ""}</span>
                      )}
                    </div>

                    {/* Apontamentos expandidos */}
                    {expandida && resumo.apontamentos.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Histórico de apontamentos</p>
                        {resumo.apontamentos.map((ap) => (
                          <div key={ap.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-foreground">
                                {ap.dataApontamento.split("-").reverse().join("/")} · {ap.horaInicio} — {ap.horaFim}
                              </span>
                              <span className="text-muted-foreground">
                                {ap.pecasProduzidas} pç produzidas
                                {ap.pecasRefugo > 0 ? ` · ${ap.pecasRefugo} refugo` : ""}
                                {ap.pecasRetrabalho > 0 ? ` · ${ap.pecasRetrabalho} retrabalho` : ""}
                              </span>
                              {ap.observacao && (
                                <span className="text-muted-foreground/70 italic">{ap.observacao}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleExcluirApontamento(ap.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0 ml-3"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {expandida && resumo.apontamentos.length === 0 && (
                      <div className="mt-4 px-3 py-4 bg-muted/20 border border-border border-dashed rounded-xl text-center">
                        <p className="text-xs text-muted-foreground">Nenhum apontamento para esta OP ainda.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

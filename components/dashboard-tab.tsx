"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell, PieChart, Pie
} from "recharts"
import { supabase } from "@/components/supabase"
import {
  TrendingUp, TrendingDown, Package, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, RefreshCw, BarChart2
} from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OrdemProducao {
  id: string
  opNumber: string
  date: string
  productCode: string
  quantity: number
}

interface Apontamento {
  id: string
  ordemId: string
  dataApontamento: string
  pecasProduzidas: number
  pecasRefugo: number
  pecasRetrabalho: number
}

interface DailyCapacity {
  date: string
  globalCapacity: number
  downtime: number
}

type Periodo = "semana" | "mes" | "trimestre" | "custom"

const DEFAULT_SHIFT_CAPACITY_SECONDS = 29880

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDays(base: string, n: number): string {
  const d = new Date(base + "T00:00:00")
  d.setDate(d.getDate() + n)
  return toStr(d)
}

function getMondayOfWeek(): string {
  const d = new Date()
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return toStr(d)
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

function formatMinutes(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h}h` : `${h}h ${r}min`
}

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Últimos 3 meses",
  custom: "Personalizado",
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold text-foreground">{typeof entry.value === "number" ? entry.value.toLocaleString("pt-BR") : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function DashboardTab() {
  const [ordens, setOrdens] = useState<OrdemProducao[]>([])
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [capacidades, setCapacidades] = useState<DailyCapacity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [periodo, setPeriodo] = useState<Periodo>("semana")
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  // ─── Datas do período ─────────────────────────────────────────────────────

  const { dateStart, dateEnd } = useMemo(() => {
    const today = toStr(new Date())
    if (periodo === "semana") {
      const monday = getMondayOfWeek()
      return { dateStart: monday, dateEnd: addDays(monday, 4) }
    }
    if (periodo === "mes") {
      const d = new Date()
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
      return { dateStart: start, dateEnd: today }
    }
    if (periodo === "trimestre") {
      return { dateStart: addDays(today, -90), dateEnd: today }
    }
    return { dateStart: customStart || addDays(today, -30), dateEnd: customEnd || today }
  }, [periodo, customStart, customEnd])

  // ─── Carga de dados ───────────────────────────────────────────────────────

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return

      const [{ data: opsData }, { data: apData }, { data: capData }] = await Promise.all([
        supabase.from("ordens_producao").select("*").eq("user_id", userId),
        supabase.from("apontamentos").select("*").eq("user_id", userId),
        supabase.from("capacidade_diaria").select("*").eq("user_id", userId),
      ])

      setOrdens((opsData || []).map((op: any) => ({
        id: op.id, opNumber: op.numero_op, date: op.data_programacao,
        productCode: op.produto_codigo, quantity: op.quantidade,
      })))

      setApontamentos((apData || []).map((a: any) => ({
        id: a.id, ordemId: a.ordem_id, dataApontamento: a.data_apontamento,
        pecasProduzidas: a.pecas_produzidas, pecasRefugo: a.pecas_refugo,
        pecasRetrabalho: a.pecas_retrabalho,
      })))

      setCapacidades((capData || []).map((c: any) => ({
        date: c.data_excecao, globalCapacity: Number(c.capacidade_global), downtime: Number(c.tempo_parada),
      })))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ─── Filtragem por período ────────────────────────────────────────────────

  const ordensFiltradas = useMemo(() =>
    ordens.filter(op => op.date >= dateStart && op.date <= dateEnd),
    [ordens, dateStart, dateEnd]
  )

  const apontamentosFiltrados = useMemo(() =>
    apontamentos.filter(a => a.dataApontamento >= dateStart && a.dataApontamento <= dateEnd),
    [apontamentos, dateStart, dateEnd]
  )

  // ─── KPIs globais ─────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalOPs = ordensFiltradas.length
    const todayStr = toStr(new Date())

    // OP concluída: total apontado >= quantity
    const opsConcluidas = ordensFiltradas.filter(op => {
      const total = apontamentos.filter(a => a.ordemId === op.id).reduce((s, a) => s + a.pecasProduzidas, 0)
      return total >= op.quantity
    }).length

    const opsAtrasadas = ordensFiltradas.filter(op => {
      const total = apontamentos.filter(a => a.ordemId === op.id).reduce((s, a) => s + a.pecasProduzidas, 0)
      return total < op.quantity && op.date < todayStr
    })

    const totalProduzidas = apontamentosFiltrados.reduce((s, a) => s + a.pecasProduzidas, 0)
    const totalRefugo = apontamentosFiltrados.reduce((s, a) => s + a.pecasRefugo, 0)
    const totalRetrabalho = apontamentosFiltrados.reduce((s, a) => s + a.pecasRetrabalho, 0)
    const taxaRefugo = totalProduzidas + totalRefugo > 0
      ? ((totalRefugo / (totalProduzidas + totalRefugo)) * 100)
      : 0

    // Ocupação média (dias com dados)
    const daysWithData = Array.from(new Set(ordensFiltradas.map(o => o.date)))
    const ocupacaoMedia = daysWithData.length > 0
      ? daysWithData.reduce((s, date) => {
          const cap = capacidades.find(c => c.date === date)
          const real = Math.max(0, (cap?.globalCapacity ?? DEFAULT_SHIFT_CAPACITY_SECONDS) - (cap?.downtime ?? 0))
          // Ocupação simplificada: conta OPs do dia como carga
          const opsNoDia = ordensFiltradas.filter(o => o.date === date).length
          return s + Math.min(100, (opsNoDia / Math.max(1, real / 3600)) * 10)
        }, 0) / daysWithData.length
      : 0

    return { totalOPs, opsConcluidas, opsAtrasadas, totalProduzidas, totalRefugo, totalRetrabalho, taxaRefugo, ocupacaoMedia }
  }, [ordensFiltradas, apontamentosFiltrados, apontamentos, capacidades])

  // ─── Gráfico 1: Planejado x Realizado por OP ─────────────────────────────

  const planejadoRealizadoData = useMemo(() => {
    return ordensFiltradas.slice(0, 12).map(op => {
      const realizado = apontamentos
        .filter(a => a.ordemId === op.id)
        .reduce((s, a) => s + a.pecasProduzidas, 0)
      return {
        name: op.opNumber.replace("OP-", "").replace("op-", ""),
        Planejado: op.quantity,
        Realizado: realizado,
        pct: op.quantity > 0 ? Math.round((realizado / op.quantity) * 100) : 0,
      }
    })
  }, [ordensFiltradas, apontamentos])

  // ─── Gráfico 2: Refugo por produto ───────────────────────────────────────

  const refugoPorProduto = useMemo(() => {
    const map: Record<string, { refugo: number; produzido: number }> = {}
    apontamentosFiltrados.forEach(a => {
      const op = ordens.find(o => o.id === a.ordemId)
      if (!op) return
      if (!map[op.productCode]) map[op.productCode] = { refugo: 0, produzido: 0 }
      map[op.productCode].refugo += a.pecasRefugo
      map[op.productCode].produzido += a.pecasProduzidas
    })
    return Object.entries(map)
      .map(([produto, d]) => ({
        produto,
        Refugo: d.refugo,
        taxa: d.produzido + d.refugo > 0 ? ((d.refugo / (d.produzido + d.refugo)) * 100).toFixed(1) : "0.0",
      }))
      .sort((a, b) => b.Refugo - a.Refugo)
      .slice(0, 8)
  }, [apontamentosFiltrados, ordens])

  // ─── Gráfico 3: Produção diária ───────────────────────────────────────────

  const producaoDiaria = useMemo(() => {
    const map: Record<string, { produzidas: number; refugo: number }> = {}
    apontamentosFiltrados.forEach(a => {
      if (!map[a.dataApontamento]) map[a.dataApontamento] = { produzidas: 0, refugo: 0 }
      map[a.dataApontamento].produzidas += a.pecasProduzidas
      map[a.dataApontamento].refugo += a.pecasRefugo
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ data: formatDateShort(date), Produzidas: d.produzidas, Refugo: d.refugo }))
  }, [apontamentosFiltrados])

  // ─── Gráfico 4: Status das OPs (Pizza) ───────────────────────────────────

  const statusOPs = useMemo(() => {
    const todayStr = toStr(new Date())
    let concluidas = 0, andamento = 0, atrasadas = 0

    ordensFiltradas.forEach(op => {
      const total = apontamentos.filter(a => a.ordemId === op.id).reduce((s, a) => s + a.pecasProduzidas, 0)
      if (total >= op.quantity) concluidas++
      else if (op.date < todayStr) atrasadas++
      else andamento++
    })

    return [
      { name: "Concluídas", value: concluidas, color: "#22c55e" },
      { name: "Em andamento", value: andamento, color: "#0057FF" },
      { name: "Atrasadas", value: atrasadas, color: "#ef4444" },
    ].filter(d => d.value > 0)
  }, [ordensFiltradas, apontamentos])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <BarChart2 className="h-8 w-8 text-primary animate-pulse" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold animate-pulse">Carregando dashboard...</span>
        </div>
      </div>
    )
  }

  const temDados = ordensFiltradas.length > 0 || apontamentosFiltrados.length > 0

  return (
    <div className="space-y-6 pb-8">

      {/* Header com filtro de período */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateShort(dateStart)} — {formatDateShort(dateEnd)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de período */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodMenu(p => !p)}
              className="flex items-center gap-2 h-9 px-4 bg-card border border-border rounded-xl text-sm font-bold text-foreground hover:border-primary/50 transition-colors"
            >
              {PERIODO_LABELS[periodo]}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {showPeriodMenu && (
              <div className="absolute right-0 top-11 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                {(Object.entries(PERIODO_LABELS) as [Periodo, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setPeriodo(key); setShowPeriodMenu(false) }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${periodo === key ? "text-primary font-bold bg-primary/5" : "text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Datas custom */}
          {periodo === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="h-9 px-3 bg-input border border-border rounded-xl text-xs text-foreground" />
              <span className="text-muted-foreground text-xs">—</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="h-9 px-3 bg-input border border-border rounded-xl text-xs text-foreground" />
            </div>
          )}

          {/* Atualizar */}
          <button
            onClick={() => loadData(true)}
            className={`h-9 w-9 flex items-center justify-center bg-card border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors ${refreshing ? "animate-spin" : ""}`}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sem dados */}
      {!temDados && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BarChart2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground">Nenhum dado no período selecionado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">Crie OPs no PCP e registre apontamentos para visualizar o dashboard.</p>
        </div>
      )}

      {temDados && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                label: "OPs no período",
                value: kpis.totalOPs,
                icon: Package,
                color: "text-primary",
                bg: "bg-primary/10",
                detail: null,
              },
              {
                label: "Concluídas",
                value: kpis.opsConcluidas,
                icon: CheckCircle2,
                color: "text-green-600",
                bg: "bg-green-500/10",
                detail: kpis.totalOPs > 0 ? `${Math.round((kpis.opsConcluidas / kpis.totalOPs) * 100)}%` : null,
              },
              {
                label: "Atrasadas",
                value: kpis.opsAtrasadas.length,
                icon: AlertTriangle,
                color: kpis.opsAtrasadas.length > 0 ? "text-destructive" : "text-muted-foreground",
                bg: kpis.opsAtrasadas.length > 0 ? "bg-destructive/10" : "bg-muted/50",
                detail: null,
              },
              {
                label: "Peças Produzidas",
                value: kpis.totalProduzidas.toLocaleString("pt-BR"),
                icon: TrendingUp,
                color: "text-primary",
                bg: "bg-primary/10",
                detail: null,
              },
              {
                label: "Refugo",
                value: kpis.totalRefugo.toLocaleString("pt-BR"),
                icon: TrendingDown,
                color: kpis.taxaRefugo > 5 ? "text-destructive" : "text-amber-500",
                bg: kpis.taxaRefugo > 5 ? "bg-destructive/10" : "bg-amber-500/10",
                detail: `${kpis.taxaRefugo.toFixed(1)}%`,
              },
              {
                label: "Retrabalho",
                value: kpis.totalRetrabalho.toLocaleString("pt-BR"),
                icon: Clock,
                color: kpis.totalRetrabalho > 0 ? "text-amber-500" : "text-muted-foreground",
                bg: kpis.totalRetrabalho > 0 ? "bg-amber-500/10" : "bg-muted/50",
                detail: null,
              },
            ].map(({ label, value, icon: Icon, color, bg, detail }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  {detail && <p className={`text-[10px] font-bold ${color} mt-0.5`}>{detail}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Gráficos linha 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Planejado x Realizado */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Planejado × Realizado por OP</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Quantidade meta versus peças efetivamente produzidas</p>
              </div>
              <div className="p-4">
                {planejadoRealizadoData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem OPs no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={planejadoRealizadoData} barGap={4} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Planejado" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Realizado" fill="#0057FF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Status das OPs (Pizza) */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Status das OPs</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Distribuição por situação no período</p>
              </div>
              <div className="p-4 flex flex-col items-center">
                {statusOPs.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={statusOPs} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                          {statusOPs.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 w-full mt-2">
                      {statusOPs.map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                            <span className="text-muted-foreground">{s.name}</span>
                          </div>
                          <span className="font-bold text-foreground">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Gráficos linha 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Produção diária */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Produção Diária</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Peças produzidas e refugo por dia</p>
              </div>
              <div className="p-4">
                {producaoDiaria.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem apontamentos no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={producaoDiaria}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="Produzidas" stroke="#0057FF" strokeWidth={2} dot={{ r: 3, fill: "#0057FF" }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Refugo" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Refugo por produto */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Refugo por Produto</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ranking de perdas por código de produto</p>
              </div>
              <div className="p-4">
                {refugoPorProduto.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem refugo registrado no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={refugoPorProduto} layout="vertical" barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="produto" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Refugo" radius={[0, 4, 4, 0]}>
                        {refugoPorProduto.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#ef4444" : i === 1 ? "#f97316" : "#fbbf24"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* OPs atrasadas */}
          {kpis.opsAtrasadas.length > 0 && (
            <div className="bg-card border border-destructive/30 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-destructive/20 bg-destructive/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-bold text-destructive">OPs Atrasadas</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-destructive/15 text-destructive rounded-full">{kpis.opsAtrasadas.length}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ordens com data vencida e produção não concluída</p>
              </div>
              <div className="divide-y divide-border">
                {kpis.opsAtrasadas.map(op => {
                  const produzido = apontamentos.filter(a => a.ordemId === op.id).reduce((s, a) => s + a.pecasProduzidas, 0)
                  const pct = op.quantity > 0 ? Math.round((produzido / op.quantity) * 100) : 0
                  const diasAtraso = Math.floor((new Date().getTime() - new Date(op.date + "T00:00:00").getTime()) / 86400000)
                  return (
                    <div key={op.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{op.opNumber}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{op.productCode}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">
                            {diasAtraso}d de atraso
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-destructive rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground flex-shrink-0">{produzido}/{op.quantity} pç ({pct}%)</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

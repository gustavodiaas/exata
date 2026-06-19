"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell, PieChart, Pie
} from "recharts"
import { supabase } from "@/components/supabase"
import {
  TrendingUp, TrendingDown, Package, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, RefreshCw, BarChart2,
  Bell, X, Factory
} from "lucide-react"

interface SupabaseOrdem {
  id: string
  numero_op: string
  data_programacao: string
  produto_codigo: string
  quantidade: number
}

interface SupabaseApontamento {
  id: string
  ordem_id: string
  data_apontamento: string
  pecas_produzidas: number
  pecas_refugo: number
  pecas_retrabalho: number
  maquina_id?: string
}

interface SupabaseCapacidade {
  data_excecao: string
  capacidade_global: number
  tempo_parada: number
}

interface SupabaseMaquina {
  id: string
  nome: string
}

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
  maquina_id?: string
}

interface Maquina {
  id: string
  nome: string
}

interface DailyCapacity {
  date: string
  globalCapacity: number
  downtime: number
}

type Periodo = "semana" | "mes" | "trimestre" | "custom"

const DEFAULT_SHIFT_CAPACITY_SECONDS = 29880

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

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Últimos 3 meses",
  custom: "Personalizado",
}

interface TooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold text-foreground">{typeof entry.value === "number" ? entry.value.toLocaleString("pt-BR") : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardTab({ empresaAtivaId }: { empresaAtivaId: string | null }) {
  const [ordens, setOrdens] = useState<OrdemProducao[]>([])
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [capacidades, setCapacidades] = useState<DailyCapacity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [periodo, setPeriodo] = useState<Periodo>("semana")
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

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

  const loadData = async (silent = false) => {
    if (!empresaAtivaId) return

    if (!silent) setLoading(true)
    else setRefreshing(true)
    
    try {
      const fetchTable = async (table: string) => {
        const response = await fetch("/api/admin/get-dados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table, empresaId: empresaAtivaId }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        return result.data || []
      }

      const [opsData, apData, capData, maqData] = await Promise.all([
        fetchTable("ordens_producao"),
        fetchTable("apontamentos"),
        fetchTable("capacidade_diaria"),
        fetchTable("maquinas"),
      ])

      setOrdens(((opsData as SupabaseOrdem[]) || []).map(op => ({
        id: op.id, opNumber: op.numero_op, date: op.data_programacao,
        productCode: op.produto_codigo, quantity: op.quantidade,
      })))

      setApontamentos(((apData as SupabaseApontamento[]) || []).map(a => ({
        id: a.id, ordemId: a.ordem_id, dataApontamento: a.data_apontamento,
        pecasProduzidas: a.pecas_produzidas, pecasRefugo: a.pecas_refugo,
        pecasRetrabalho: a.pecas_retrabalho, maquina_id: a.maquina_id
      })))

      setCapacidades(((capData as SupabaseCapacidade[]) || []).map(c => ({
        date: c.data_excecao, globalCapacity: Number(c.capacidade_global), downtime: Number(c.tempo_parada),
      })))

      setMaquinas((maqData as SupabaseMaquina[]) || [])
    } catch (e: any) {
      console.error("Erro ao carregar dashboard:", e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { 
    if (empresaAtivaId) {
      loadData() 
    }
  }, [empresaAtivaId])

  const ordensFiltradas = useMemo(() => ordens.filter(op => op.date >= dateStart && op.date <= dateEnd), [ordens, dateStart, dateEnd])
  const apontamentosFiltrados = useMemo(() => apontamentos.filter(a => a.dataApontamento >= dateStart && a.dataApontamento <= dateEnd), [apontamentos, dateStart, dateEnd])

  const kpis = useMemo(() => {
    const totalOPs = ordensFiltradas.length
    const opsConcluidas = ordensFiltradas.filter(op => {
      const total = apontamentos.filter(a => a.ordemId === op.id).reduce((s, a) => s + a.pecasProduzidas, 0)
      return total >= op.quantity
    }).length

    const totalProduzidas = apontamentosFiltrados.reduce((s, a) => s + a.pecasProduzidas, 0)
    const totalRefugo = apontamentosFiltrados.reduce((s, a) => s + a.pecasRefugo, 0)
    const totalRetrabalho = apontamentosFiltrados.reduce((s, a) => s + a.pecasRetrabalho, 0)
    const taxaRefugo = totalProduzidas + totalRefugo > 0 ? ((totalRefugo / (totalProduzidas + totalRefugo)) * 100) : 0
    
    return { totalOPs, opsConcluidas, totalProduzidas, totalRefugo, totalRetrabalho, taxaRefugo }
  }, [ordensFiltradas, apontamentosFiltrados, apontamentos])

  const producaoPorMaquina = useMemo(() => {
    const map: Record<string, number> = {}
    apontamentosFiltrados.forEach(a => {
      const maq = maquinas.find(m => m.id === a.maquina_id)
      const nome = maq ? maq.nome : "Manual / Sem Máquina"
      map[nome] = (map[nome] || 0) + a.pecasProduzidas
    })
    return Object.entries(map).map(([nome, qtd]) => ({ nome, qtd })).sort((a,b) => b.qtd - a.qtd)
  }, [apontamentosFiltrados, maquinas])

  const alertas = useMemo(() => {
    const lista: { id: string; tipo: "critico" | "atencao"; titulo: string; descricao: string }[] = []
    if (kpis.taxaRefugo > 5) {
      lista.push({ id: "refugo-alto", tipo: "critico", titulo: `Refugo alto: ${kpis.taxaRefugo.toFixed(1)}%`, descricao: "Verifique os processos na fábrica." })
    }
    return lista.filter(a => !dismissedAlerts.has(a.id))
  }, [kpis, dismissedAlerts])

  if (loading) return <div className="flex h-60 items-center justify-center text-xs text-muted-foreground animate-pulse font-bold uppercase">Carregando painel...</div>

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Dashboard Operacional</h2>
        </div>
        <button onClick={() => loadData(true)} className={`h-9 w-9 flex items-center justify-center bg-card border border-border rounded-xl text-muted-foreground hover:text-primary transition-colors ${refreshing ? "animate-spin" : ""}`}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Peças Produzidas", value: kpis.totalProduzidas.toLocaleString("pt-BR"), icon: Package },
          { label: "Taxa de Refugo", value: `${kpis.taxaRefugo.toFixed(1)}%`, icon: TrendingDown },
          { label: "OPs Concluídas", value: kpis.opsConcluidas, icon: CheckCircle2 },
          { label: "Retrabalho", value: kpis.totalRetrabalho, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Icon className="h-4 w-4" /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">{label}</p>
              <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Factory className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Produção por Máquina</h3>
          </div>
          {producaoPorMaquina.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem apontamentos por máquina</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={producaoPorMaquina} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} axisLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="qtd" fill="#0057FF" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-foreground">Alertas</h3>
          </div>
          {alertas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tudo operando dentro dos limites.</p>
          ) : (
            alertas.map(a => (
              <div key={a.id} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs">
                <p className="font-bold text-amber-600">{a.titulo}</p>
                <p className="text-muted-foreground mt-1">{a.descricao}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

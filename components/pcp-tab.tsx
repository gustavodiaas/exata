"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Calendar, ShieldAlert, TrendingUp, LayoutGrid, CalendarDays, ListOrdered } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface RoutingStep {
  name: string
  cycleTime: number
  setupTime: number
}

interface Product {
  code: string
  description: string
  steps: RoutingStep[]
}

interface ProductionOrder {
  id: string
  opNumber: string
  date: string
  productCode: string
  quantity: number
  calculationRule: "soma" | "media" | "gargalo"
  groupSetup: boolean
}

interface DailyCapacity {
  date: string
  globalCapacity: number // Em segundos
  downtime: number // Em segundos
}

export function PCPTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [capacities, setCapacities] = useState<DailyCapacity[]>([])

  // Visões do Heijunka
  const [viewMode, setViewMode] = useState<"grafico" | "calendario" | "lista">("grafico")

  // Estados dos formulários de OP
  const [opNumber, setOpNumber] = useState("")
  const [opDate, setOpDate] = useState("")
  const [opProductCode, setOpProductCode] = useState("")
  const [opQuantity, setOpQuantity] = useState("")
  const [opRule, setOpRule] = useState<"soma" | "media" | "gargalo">("soma")
  const [opGroupSetup, setOpGroupSetup] = useState(false)

  // Estados para Exceções/Paradas
  const [selectedDate, setSelectedDate] = useState("")
  const [capacityValue, setCapacityValue] = useState("")
  const [capacityUnit, setCapacityUnit] = useState<"hours" | "minutes">("hours")
  const [downtimeValue, setDowntimeValue] = useState("")

  const { toast } = useToast()

  useEffect(() => {
    const savedProducts = localStorage.getItem("gbo_products")
    const savedOrders = localStorage.getItem("pcp_orders")
    const savedCapacities = localStorage.getItem("pcp_capacities")

    if (savedProducts) setProducts(JSON.parse(savedProducts))
    if (savedOrders) setOrders(JSON.parse(savedOrders))
    if (savedCapacities) setCapacities(JSON.parse(savedCapacities))
  }, [])

  const saveAndSync = (newOrders: ProductionOrder[], newCapacities: DailyCapacity[]) => {
    setOrders(newOrders)
    setCapacities(newCapacities)
    localStorage.setItem("pcp_orders", JSON.stringify(newOrders))
    localStorage.setItem("pcp_capacities", JSON.stringify(newCapacities))
  }

  const calculateOPTime = (op: ProductionOrder): number => {
    const product = products.find((p) => p.code === op.productCode)
    if (!product || product.steps.length === 0) return 0

    const cycleTimes = product.steps.map((s) => s.cycleTime)
    let baseTime = 0

    if (op.calculationRule === "soma") {
      baseTime = cycleTimes.reduce((a, b) => a + b, 0)
    } else if (op.calculationRule === "media") {
      baseTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    } else if (op.calculationRule === "gargalo") {
      baseTime = Math.max(...cycleTimes)
    }

    const totalSetup = op.groupSetup ? 0 : product.steps.reduce((a, b) => a + b.setupTime, 0)
    return op.quantity * baseTime + totalSetup
  }

  // O Coração do Heijunka: Cálculo em Cascata de Carga Diária
  const getHeijunkaData = () => {
    const allDates = Array.from(
      new Set([...orders.map((o) => o.date), ...capacities.map((c) => c.date)])
    ).sort()

    let accumulatedBacklog = 0
    const dashboardData: Record<string, any> = {}

    allDates.forEach((date) => {
      const dayCapacityConfig = capacities.find((c) => c.date === date)
      const globalCap = dayCapacityConfig?.globalCapacity ?? 29880
      const downtime = dayCapacityConfig?.downtime ?? 0
      const realCapacity = Math.max(0, globalCap - downtime)

      const dayOrders = orders.filter((o) => o.date === date)
      const directLoad = dayOrders.reduce((sum, op) => sum + calculateOPTime(op), 0)

      const totalDemanded = directLoad + accumulatedBacklog
      const overflow = Math.max(0, totalDemanded - realCapacity)
      const occupation = realCapacity > 0 ? Math.min(100, (totalDemanded / realCapacity) * 100) : 0

      dashboardData[date] = {
        date,
        realCapacity,
        directLoad,
        backlog: accumulatedBacklog,
        totalDemanded,
        overflow,
        occupation,
      }

      accumulatedBacklog = overflow
    })

    return dashboardData
  }

  const heijunkaDashboard = getHeijunkaData()
  const dashboardArray = Object.values(heijunkaDashboard)

  const handleAddOP = () => {
    if (!opNumber || !opDate || !opProductCode || !opQuantity) {
      toast({ title: "Erro", description: "Preencha todos os campos da OP.", variant: "destructive" })
      return
    }

    const newOP: ProductionOrder = {
      id: Date.now().toString(),
      opNumber: opNumber.trim(),
      date: opDate,
      productCode: opProductCode,
      quantity: parseInt(opQuantity),
      calculationRule: opRule,
      groupSetup: opGroupSetup,
    }

    const updated = [...orders, newOP]
    saveAndSync(updated, capacities)
    setOpNumber("")
    setOpQuantity("")
    toast({ title: "✅ OP Adicionada", description: "Carga recalculada com sucesso." })
  }

  const handleRemoveOP = (id: string) => {
    const updated = orders.filter((o) => o.id !== id)
    saveAndSync(updated, capacities)
    toast({ title: "OP Removida", description: "Carga recalculada." })
  }

  const handleSaveDowntime = () => {
    if (!selectedDate) {
      toast({ title: "Erro", description: "Selecione uma data para registrar a exceção.", variant: "destructive" })
      return
    }

    const currentCapConfig = capacities.find((c) => c.date === selectedDate)
    const updatedCapacities = capacities.filter((c) => c.date !== selectedDate)

    // Converte a capacidade informada para segundos (ou mantém o padrão)
    let capInSeconds = currentCapConfig?.globalCapacity ?? 29880
    if (capacityValue) {
      const val = parseFloat(capacityValue)
      capInSeconds = capacityUnit === "hours" ? val * 3600 : val * 60
    }

    // Converte a parada informada de minutos para segundos
    let downInSeconds = currentCapConfig?.downtime ?? 0
    if (downtimeValue) {
      downInSeconds = parseFloat(downtimeValue) * 60 
    }

    updatedCapacities.push({
      date: selectedDate,
      globalCapacity: capInSeconds,
      downtime: downInSeconds,
    })

    saveAndSync(orders, updatedCapacities)
    setCapacityValue("")
    setDowntimeValue("")
    toast({ title: "✅ Capacidade Atualizada", description: "O fluxo diário foi recalculado." })
  }

  return (
    <div className="space-y-6">
      {/* 1. Dashboard de Capacidade Diária (Visão de Carga) */}
      <div className="grid gap-4 md:grid-cols-3">
        
        {/* Painel Gerenciamento de Exceções Atualizado */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Gerenciamento de Exceções
              <ShieldAlert className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data da Exceção</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-9 text-xs bg-input border-border" />
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tempo Disponível</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Ex: 8.0" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} className="h-9 text-xs bg-input border-border" />
                <Select value={capacityUnit} onValueChange={(v: any) => setCapacityUnit(v)}>
                  <SelectTrigger className="h-9 text-xs border-border bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Paradas Planejadas (Minutos)</Label>
              <Input type="number" placeholder="Ex: 45 (Refeição/Manutenção)" value={downtimeValue} onChange={(e) => setDowntimeValue(e.target.value)} className="h-9 text-xs bg-input border-border" />
            </div>

            <Button size="sm" className="w-full h-9 text-xs font-bold uppercase tracking-wider bg-primary hover:opacity-90 text-primary-foreground" onClick={handleSaveDowntime} disabled={!selectedDate}>
              Aplicar Nova Restrição
            </Button>
          </CardContent>
        </Card>

        {/* Painel do Heijunka Diário com Alternância de Visão */}
        <Card className="bg-card border-border shadow-sm md:col-span-2 flex flex-col">
          <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Visão de Carga Global Nivelada
            </CardTitle>
            
            {/* Seletor de Visão de UX */}
            <div className="flex bg-input border border-border p-1 rounded-lg">
              <button 
                onClick={() => setViewMode("grafico")} 
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grafico" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Visão Gráfica"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("calendario")} 
                className={`p-1.5 rounded-md transition-colors ${viewMode === "calendario" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Visão Calendário"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("lista")} 
                className={`p-1.5 rounded-md transition-colors ${viewMode === "lista" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Visão em Lista"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-4 overflow-auto">
            {dashboardArray.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground py-8">
                Nenhuma ordem ou capacidade registrada para gerar o fluxo.
              </div>
            ) : (
              <>
                {/* 1. MODO GRÁFICO (Cards Horizontais) */}
                {viewMode === "grafico" && (
                  <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                    {dashboardArray.map((day: any) => (
                      <div key={day.date} className="min-w-[150px] p-3 bg-muted/20 border border-border rounded-xl flex flex-col justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-primary" /> {day.date.split("-").reverse().slice(0, 2).join("/")}
                        </span>
                        <div className="my-2.5 w-full bg-input h-2.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${day.overflow > 0 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${day.occupation}%` }}></div>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">Ocupação: <strong className="text-foreground">{day.occupation.toFixed(0)}%</strong></span>
                        {day.overflow > 0 && <span className="text-[10px] text-destructive font-bold mt-1">Transbordo: {(day.overflow / 60).toFixed(0)} min</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. MODO CALENDÁRIO (Grade) */}
                {viewMode === "calendario" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {dashboardArray.map((day: any) => (
                      <div key={day.date} className={`p-3 border rounded-xl flex flex-col gap-1 ${day.overflow > 0 ? "bg-destructive/5 border-destructive/30" : "bg-card border-border"}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold">{day.date.split("-")[2]}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{day.date.split("-")[1]}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Ocupado</span>
                          <span className={`font-bold ${day.overflow > 0 ? "text-destructive" : "text-primary"}`}>{day.occupation.toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Carga</span>
                          <span className="font-bold text-foreground">{(day.directLoad / 3600).toFixed(1)}h</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Backlog</span>
                          <span className="font-bold text-foreground">{(day.backlog / 3600).toFixed(1)}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. MODO LISTA (Tabela Analítica) */}
                {viewMode === "lista" && (
                  <div className="w-full border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">Capacidade Líquida</th>
                          <th className="px-4 py-3 font-semibold">Carga Programada</th>
                          <th className="px-4 py-3 font-semibold">Ocupação</th>
                          <th className="px-4 py-3 font-semibold text-right">Transbordo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {dashboardArray.map((day: any) => (
                          <tr key={day.date} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{day.date.split("-").reverse().join("/")}</td>
                            <td className="px-4 py-3 text-muted-foreground">{(day.realCapacity / 3600).toFixed(1)}h</td>
                            <td className="px-4 py-3 text-foreground">{(day.directLoad / 3600).toFixed(1)}h</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${day.overflow > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                                {day.occupation.toFixed(0)}%
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${day.overflow > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {day.overflow > 0 ? `+${(day.overflow / 3600).toFixed(1)}h` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Entrada de Ordens de Produção e Fila */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-card border-border shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Programar Demanda Diária</CardTitle>
            <CardDescription>Insira ordens de produção na fila de nivelamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Número da OP</Label>
              <Input placeholder="Ex: OP-2026-001" value={opNumber} onChange={(e) => setOpNumber(e.target.value)} className="bg-input border-border h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Data de Programação</Label>
              <Input type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} className="bg-input border-border h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Produto / Roteiro</Label>
              <Select value={opProductCode} onValueChange={setOpProductCode}>
                <SelectTrigger className="bg-input border-border h-10"><SelectValue placeholder="Selecione o Roteiro" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {products.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.code} - {p.description}</SelectItem>
                  ))}
                  {products.length === 0 && (
                    <SelectItem value="none" disabled>Nenhum roteiro salvo no GBO</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Quantidade Solicitada</Label>
              <Input type="number" placeholder="Ex: 150" value={opQuantity} onChange={(e) => setOpQuantity(e.target.value)} className="bg-input border-border h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Regra de Tempo Base</Label>
              <Select value={opRule} onValueChange={(v: any) => setOpRule(v)}>
                <SelectTrigger className="bg-input border-border h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="soma">Soma dos Tempos do Roteiro</SelectItem>
                  <SelectItem value="media">Média dos Tempos</SelectItem>
                  <SelectItem value="gargalo">Tempo da Operação Gargalo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
              <div className="flex flex-col gap-0.5">
                <Label className="text-xs font-bold">Agrupar Setup?</Label>
                <span className="text-[10px] text-muted-foreground">Zera setup desta OP (Aproveitamento)</span>
              </div>
              <Switch checked={opGroupSetup} onCheckedChange={setOpGroupSetup} />
            </div>
            <Button className="w-full h-10 font-bold uppercase tracking-wider bg-primary hover:opacity-90 text-primary-foreground" onClick={handleAddOP}>
              <Plus className="h-4 w-4 mr-2" /> Inserir Ordem
            </Button>
          </CardContent>
        </Card>

        {/* Listagem das OPs Programadas */}
        <Card className="bg-card border-border shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Fila de Ordens de Produção Ativas</CardTitle>
            <CardDescription>Acompanhe e configure as regras analíticas de carga dinamicamente</CardDescription>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[500px] pr-2 custom-scrollbar space-y-2">
            {orders.map((op) => {
              const opTime = calculateOPTime(op)
              return (
                <div key={op.id} className="p-3 bg-muted/10 border border-border hover:border-primary/50 rounded-xl flex items-center justify-between transition-all">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{op.opNumber}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{op.productCode}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Data: {op.date.split("-").reverse().join("/")} | Qtd: <strong className="text-foreground">{op.quantity}</strong></span>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">Regra: {op.calculationRule}</span>
                      {op.groupSetup && <span className="text-[9px] uppercase tracking-wider font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">Setup Reaproveitado</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-foreground">{(opTime / 60).toFixed(0)} min</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveOP(op.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {orders.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-12">Nenhuma OP inserida na carteira de produção.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

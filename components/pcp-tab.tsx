"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Calendar, ShieldAlert, TrendingUp } from "lucide-react"
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
  globalCapacity: number // Padrão 29880s
  downtime: number
}

export function PCPTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [capacities, setCapacities] = useState<DailyCapacity[]>([])

  // Estados dos formulários
  const [opNumber, setOpNumber] = useState("")
  const [opDate, setOpDate] = useState("")
  const [opProductCode, setOpProductCode] = useState("")
  const [opQuantity, setOpQuantity] = useState("")
  const [opRule, setOpRule] = useState<"soma" | "media" | "gargalo">("soma")
  const [opGroupSetup, setOpGroupSetup] = useState(false)

  // Estado para paradas diárias
  const [selectedDate, setSelectedDate] = useState("")
  const [downtimeValue, setDowntimeValue] = useState("")

  const { toast } = useToast()

  // Carrega dados do localStorage
  useEffect(() => {
    const savedProducts = localStorage.getItem("gbo_products")
    const savedOrders = localStorage.getItem("pcp_orders")
    const savedCapacities = localStorage.getItem("pcp_capacities")

    // Puxa do GBO se houver roteiros mockados ou salvos lá
    if (savedProducts) setProducts(JSON.parse(savedProducts))
    if (savedOrders) setOrders(JSON.parse(savedOrders))
    if (savedCapacities) setCapacities(JSON.parse(savedCapacities))
  }, [])

  // Salva alterações no localStorage
  const saveAndSync = (newOrders: ProductionOrder[], newCapacities: DailyCapacity[]) => {
    setOrders(newOrders)
    setCapacities(newCapacities)
    localStorage.setItem("pcp_orders", JSON.stringify(newOrders))
    localStorage.setItem("pcp_capacities", JSON.stringify(newCapacities))
  }

  // Lógica de cálculo do tempo de uma OP com regras Lean
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
    // Agrupa todas as datas únicas e ordena cronologicamente
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

      // O excedente acumula para a data seguinte da iteração
      accumulatedBacklog = overflow
    })

    return dashboardData
  }

  const heijunkaDashboard = getHeijunkaData()

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
    if (!selectedDate || !downtimeValue) return

    const currentCapConfig = capacities.find((c) => c.date === selectedDate)
    const updatedCapacities = capacities.filter((c) => c.date !== selectedDate)

    updatedCapacities.push({
      date: selectedDate,
      globalCapacity: currentCapConfig?.globalCapacity ?? 29880,
      downtime: parseFloat(downtimeValue),
    })

    saveAndSync(orders, updatedCapacities)
    setDowntimeValue("")
    toast({ title: "✅ Evento Registrado", description: "Capacidade real atualizada." })
  }

  return (
    <div className="space-y-6">
      {/* 1. Dashboard de Capacidade Diária (Visão de Carga) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-panel border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Gerenciamento de Exceções
              <ShieldAlert className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-8 text-xs bg-background" />
              <Input type="number" placeholder="Parada (segundos)" value={downtimeValue} onChange={(e) => setDowntimeValue(e.target.value)} className="h-8 text-xs bg-background" />
            </div>
            <Button size="sm" className="w-full h-8 text-xs tech-glow" onClick={handleSaveDowntime} disabled={!selectedDate}>
              Aplicar Restrição
            </Button>
          </CardContent>
        </Card>

        {/* Painel do Heijunka Diário Simplificado */}
        <Card className="glass-panel border-primary/20 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Visão de Carga Global Nivelada (Heijunka)
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[120px] overflow-x-auto flex gap-4 pb-2">
            {Object.values(heijunkaDashboard).map((day: any) => (
              <div key={day.date} className="min-w-[140px] p-2.5 bg-muted/20 border border-border/50 rounded-xl flex flex-col justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> {day.date.split("-").reverse().slice(0, 2).join("/")}</span>
                <div className="my-1.5 w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${day.overflow > 0 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${day.occupation}%` }}></div>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">Ocupação: <strong className="text-foreground">{day.occupation.toFixed(0)}%</strong></span>
                {day.overflow > 0 && <span className="text-[9px] text-destructive font-bold">Transbordo: {day.overflow.toFixed(0)}s</span>}
              </div>
            ))}
            {Object.keys(heijunkaDashboard).length === 0 && (
              <div className="text-xs text-muted-foreground m-auto py-4">Nenhuma ordem ou capacidade registrada para gerar o fluxo.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Entrada de Ordens de Produção e Fila */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-panel border-primary/20 col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Programar Demanda Diária</CardTitle>
            <CardDescription>Insira ordens de produção na fila de nivelamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Número da OP</Label>
              <Input placeholder="Ex: OP-2026-001" value={opNumber} onChange={(e) => setOpNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data de Programação</Label>
              <Input type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Produto / Roteiro</Label>
              <Select value={opProductCode} onValueChange={setOpProductCode}>
                <SelectTrigger><SelectValue placeholder="Selecione o Roteiro" /></SelectTrigger>
                <SelectContent>
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
              <Label className="text-xs">Quantidade Solicitada</Label>
              <Input type="number" placeholder="Ex: 150" value={opQuantity} onChange={(e) => setOpQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Regra de Tempo Base</Label>
              <Select value={opRule} onValueChange={(v: any) => setOpRule(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soma">Soma dos Tempos do Roteiro</SelectItem>
                  <SelectItem value="media">Média dos Tempos</SelectItem>
                  <SelectItem value="gargalo">Tempo da Operação Gargalo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border/50 rounded-lg">
              <div className="flex flex-col gap-0.5">
                <Label className="text-xs">Agrupar Setup?</Label>
                <span className="text-[10px] text-muted-foreground">Zera setup desta OP (Aproveitamento)</span>
              </div>
              <Switch checked={opGroupSetup} onCheckedChange={setOpGroupSetup} />
            </div>
            <Button className="w-full tech-glow" onClick={handleAddOP}><Plus className="h-4 w-4 mr-2" /> Inserir Ordem</Button>
          </CardContent>
        </Card>

        {/* Listagem das OPs Programadas */}
        <Card className="glass-panel border-primary/20 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Fila de Ordens de Produção Ativas</CardTitle>
            <CardDescription>Acompanhe e configure as regras analíticas de carga dinamicamente</CardDescription>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[460px] pr-2 custom-scrollbar space-y-2">
            {orders.map((op) => {
              const opTime = calculateOPTime(op)
              return (
                <div key={op.id} className="p-3 bg-muted/10 border border-border/50 hover:border-primary/30 rounded-xl flex items-center justify-between transition-all">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{op.opNumber}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{op.productCode}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Data: {op.date.split("-").reverse().join("/")} | Qtd: <strong>{op.quantity}</strong></span>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">Regra: {op.calculationRule}</span>
                      {op.groupSetup && <span className="text-[9px] uppercase tracking-wider font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">Setup Reaproveitado</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-foreground">{opTime.toFixed(0)}s</span>
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

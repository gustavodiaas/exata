"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
  HelpCircle,
  CheckCircle2,
  FileImage,
  ChevronDown,
  BarChart,
  Settings
} from "lucide-react"
import { GBOChart } from "@/components/gbo-chart"
import { CalculationsDashboard } from "@/components/calculations-dashboard"
import { DraggableOperationsList } from "@/components/draggable-operations-list"
import { exportToExcel, importFromExcel, downloadTemplate } from "@/components/export-utils"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Importações das Abas e da nova tela de PCP
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PCPTab } from "@/components/pcp-tab"

interface Operation {
  id: string
  name: string
  time: number
  unit: "minutes" | "seconds"
}

const validateNumber = (value: string, min = 0): { isValid: boolean; error?: string } => {
  if (!value.trim()) return { isValid: false, error: "Campo obrigatório" }
  const num = Number.parseFloat(value)
  if (isNaN(num)) return { isValid: false, error: "Deve ser um número válido" }
  if (num <= min) return { isValid: false, error: `Deve ser maior que ${min}` }
  return { isValid: true }
}

const validateText = (value: string): { isValid: boolean; error?: string } => {
  if (!value.trim()) return { isValid: false, error: "Campo obrigatório" }
  if (value.trim().length < 2) return { isValid: false, error: "Mínimo 2 caracteres" }
  return { isValid: true }
}

export default function GBOAnalysis() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [timeUnit, setTimeUnit] = useState<"minutes" | "seconds">("minutes")
  const [newOperationName, setNewOperationName] = useState("")
  const [newOperationTime, setNewOperationTime] = useState("")
  const [workShiftTime, setWorkShiftTime] = useState("")
  const [dailyDemand, setDailyDemand] = useState("")
  const [demandUnit, setDemandUnit] = useState("peças")
  const [demandPeriod, setDemandPeriod] = useState<"dia" | "mes">("dia")
  const [timeUnitTakt, setTimeUnitTakt] = useState<"minutes" | "seconds" | "hours">("minutes")
  const [previousTimeUnitTakt, setPreviousTimeUnitTakt] = useState<"minutes" | "seconds" | "hours">("minutes")
  const [errors, setErrors] = useState<{
    operationName?: string
    operationTime?: string
    workShiftTime?: string
    dailyDemand?: string
  }>({})
  const [isLoading, setIsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (workShiftTime && previousTimeUnitTakt !== timeUnitTakt) {
      const currentValue = Number.parseFloat(workShiftTime)
      if (!isNaN(currentValue)) {
        let convertedValue = currentValue

        if (previousTimeUnitTakt === "hours") {
          convertedValue = currentValue * 60
        } else if (previousTimeUnitTakt === "seconds") {
          convertedValue = currentValue / 60
        }

        if (timeUnitTakt === "hours") {
          convertedValue = convertedValue / 60
        } else if (timeUnitTakt === "seconds") {
          convertedValue = convertedValue * 60
        }

        setWorkShiftTime(convertedValue.toFixed(2))
      }
      setPreviousTimeUnitTakt(timeUnitTakt)
    }
  }, [timeUnitTakt, workShiftTime, previousTimeUnitTakt])

  const calculateTaktTime = (): number | undefined => {
    if (!workShiftTime || !dailyDemand) return undefined
    const shiftTime = Number.parseFloat(workShiftTime)
    const rawDemand = Number.parseFloat(dailyDemand)

    if (shiftTime <= 0 || rawDemand <= 0) return undefined

    const demand = demandPeriod === "mes" ? rawDemand / 21 : rawDemand

    let shiftTimeInSeconds = shiftTime
    if (timeUnitTakt === "minutes") {
      shiftTimeInSeconds = shiftTime * 60
    } else if (timeUnitTakt === "hours") {
      shiftTimeInSeconds = shiftTime * 3600
    }

    return shiftTimeInSeconds / demand
  }

  const addOperation = () => {
    const nameValidation = validateText(newOperationName)
    const timeValidation = validateNumber(newOperationTime)

    const newErrors: typeof errors = {}
    if (!nameValidation.isValid) newErrors.operationName = nameValidation.error
    if (!timeValidation.isValid) newErrors.operationTime = timeValidation.error

    setErrors(newErrors)

    if (!nameValidation.isValid || !timeValidation.isValid) {
      toast({ title: "Dados inválidos", description: "Verifique os campos destacados.", variant: "destructive" })
      return
    }

    const newOperation: Operation = {
      id: Date.now().toString(),
      name: newOperationName.trim(),
      time: Number.parseFloat(newOperationTime),
      unit: timeUnit,
    }

    setOperations([...operations, newOperation])
    setNewOperationName("")
    setNewOperationTime("")
    setErrors({})
    toast({ title: "✅ Operação adicionada", description: `"${newOperation.name}" foi adicionada.` })
  }

  const removeOperation = (id: string) => {
    const operation = operations.find((op) => op.id === id)
    setOperations(operations.filter((op) => op.id !== id))
    if (operation) toast({ title: "Operação removida", description: `"${operation.name}" foi removida.` })
  }

  const editOperation = (id: string, newName: string, newTime: number) => {
    setOperations(
      operations.map((op) => (op.id === id ? { ...op, name: newName, time: newTime } : op))
    )
    toast({ title: "✅ Atualizado", description: `Operação "${newName}" atualizada.` })
  }

  const reorderOperations = (newOperations: Operation[]) => {
    setOperations(newOperations)
    toast({ title: "✅ Ordem atualizada", description: "A ordem das operações foi reorganizada." })
  }

  const validateTaktFields = () => {
    const shiftValidation = validateNumber(workShiftTime)
    const demandValidation = validateNumber(dailyDemand)

    const newErrors: typeof errors = { ...errors }
    if (!shiftValidation.isValid) newErrors.workShiftTime = shiftValidation.error
    else delete newErrors.workShiftTime

    if (!demandValidation.isValid) newErrors.dailyDemand = demandValidation.error
    else delete newErrors.dailyDemand

    setErrors(newErrors)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addOperation()
  }

  const handleExportExcel = async () => {
    if (operations.length === 0) return
    setIsLoading(true)
    try {
      await exportToExcel(operations, timeUnit)
      toast({ title: "✅ Excel exportado", description: "A planilha foi baixada." })
    } catch (error) {
      toast({ title: "❌ Erro", description: "Falha ao exportar Excel.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportChartPDF = () => {
    if (operations.length === 0) return
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const handleImportExcel = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const importedOperations = await importFromExcel(file)
      if (importedOperations.length === 0) {
        toast({ title: "Aviso", description: "O arquivo não contém operações válidas.", variant: "destructive" })
        return
      }
      setOperations(importedOperations)
      toast({ title: "✅ Importação concluída", description: `${importedOperations.length} operações carregadas.` })
    } catch (error) {
      toast({ title: "❌ Erro", description: "Falha na importação.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          [data-radix-toast-provider], 
          [role="region"][aria-label="Notifications"], 
          .toaster,
          [data-radix-popper-content-wrapper] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        }
      `}} />

      <div className="min-h-screen bg-background relative print:min-h-0 print:bg-transparent">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />

        <div className="pt-6 pb-8 px-4 w-full flex justify-center z-50 print:hidden border-b border-border mb-6">
          <header className="w-full max-w-[95%] px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Cadastro de Produto
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <HelpCircle className="h-5 w-5" />
                    <span className="sr-only">Ajuda</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border rounded-2xl shadow-xl">
                  <DialogHeader>
                    <DialogTitle className="text-primary flex items-center gap-2 font-bold text-lg">
                      <HelpCircle className="w-5 h-5" />
                      Manual Técnico GBO
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">Protocolo Analítico de Balanceamento</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 text-sm mt-4 leading-relaxed text-justify text-foreground">
                    <p>O <strong>GBO (Gráfico de Balanceamento de Operações)</strong> é uma ferramenta analítica de fluxo. Ele plota os tempos de ciclo individuais de cada operação em relação ao Takt Time estabelecido.</p>
                    <p><strong>Objetivo:</strong> Identificar restrições sistêmicas (gargalos) e fornecer uma base de dados limpa para o nivelamento da capacidade produtiva, reduzindo ociosidade e superprodução.</p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>
        </div>

        <div className="w-full max-w-[95%] mx-auto px-4 pb-12 print:p-12 print:max-w-none print:w-[100vw] print:break-inside-avoid">
          <Tabs defaultValue="gbo" className="w-full space-y-6">
            <div className="flex justify-center print:hidden">
              <TabsList className="bg-muted p-1 rounded-xl shadow-sm h-auto border border-border">
                <TabsTrigger value="gbo" className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex items-center gap-2">
                  <BarChart className="w-4 h-4" />
                  Cadastrar Produto
                </TabsTrigger>
                <TabsTrigger value="pcp" className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Programação Fabril
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="gbo" className="outline-none space-y-6">
              <div className="flex flex-col xl:flex-row gap-8 pb-12 print:p-0">
                
                {/* COLUNA ESQUERDA: FOMULÁRIOS (30% ou 40% fluído) */}
                <div className="xl:w-[35%] flex flex-col gap-6 print:hidden">
                  
                  <div className="bg-card p-6 rounded-2xl shadow-sm border border-border space-y-4">
                    <h3 className="font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      Cálculo do Takt Time
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Demanda</span>
                        <div className="flex rounded-lg overflow-hidden border border-border">
                          <button
                            onClick={() => setDemandPeriod("dia")}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${demandPeriod === "dia" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                          >
                            Dia
                          </button>
                          <button
                            onClick={() => setDemandPeriod("mes")}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${demandPeriod === "mes" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                          >
                            Mês
                          </button>
                        </div>
                      </div>
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tempo do Turno</label>
                          <input type="number" step="0.1" min="0" placeholder="8.0" value={workShiftTime}
                            onChange={(e) => { setWorkShiftTime(e.target.value); validateTaktFields(); }} onBlur={validateTaktFields}
                            className={`w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all ${errors.workShiftTime ? "ring-2 ring-destructive" : ""}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Unidade</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium text-foreground flex items-center justify-between outline-none hover:bg-muted transition-all focus:ring-2 focus:ring-primary">
                                {timeUnitTakt === "minutes" ? "Minutos" : timeUnitTakt === "hours" ? "Horas" : "Segundos"}
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] bg-card border border-border p-2 rounded-2xl shadow-xl z-[150]">
                              <DropdownMenuItem onClick={() => setTimeUnitTakt("minutes")} className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${timeUnitTakt === "minutes" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Minutos</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTimeUnitTakt("hours")} className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${timeUnitTakt === "hours" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Horas</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTimeUnitTakt("seconds")} className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${timeUnitTakt === "seconds" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Segundos</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Demanda ({demandUnit}/{demandPeriod === "mes" ? "mês" : "dia"})</label>
                        <div className="grid grid-cols-2 gap-4">
                          <input type="number" step="1" min="0" placeholder="100" value={dailyDemand}
                            onChange={(e) => { setDailyDemand(e.target.value); validateTaktFields(); }} onBlur={validateTaktFields}
                            className={`w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all ${errors.dailyDemand ? "ring-2 ring-destructive" : ""}`}
                          />
                          <input 
                            type="text" 
                            placeholder="Ex: caixas" 
                            value={demandUnit} 
                            onChange={(e) => setDemandUnit(e.target.value)} 
                            className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                          />
                        </div>
                      </div>

                      {calculateTaktTime() && (
                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-3 mt-4">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <p className="text-sm font-semibold text-primary">
                            Takt Time: {timeUnitTakt === "hours" ? (calculateTaktTime()! / 3600).toFixed(2)
                              : timeUnitTakt === "minutes" ? (calculateTaktTime()! / 60).toFixed(2)
                              : calculateTaktTime()!.toFixed(2)} {timeUnitTakt === "hours" ? "h" : timeUnitTakt === "minutes" ? "min" : "seg"}/{demandUnit}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-card p-6 rounded-2xl shadow-sm border border-border space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h3 className="font-bold text-foreground text-sm tracking-wide uppercase">Nova Operação</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 px-3 rounded-lg bg-input border border-border text-[10px] font-bold text-muted-foreground flex items-center gap-1 outline-none hover:bg-muted transition-all focus:ring-2 focus:ring-primary">
                            {timeUnit === "minutes" ? "Minutos" : "Segundos"}
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32 bg-card border border-border p-1.5 rounded-xl shadow-xl z-[150]">
                          <DropdownMenuItem onClick={() => setTimeUnit("minutes")} className={`w-full text-left text-[10px] font-bold py-2 px-2.5 rounded-lg cursor-pointer transition-all ${timeUnit === "minutes" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Minutos</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTimeUnit("seconds")} className={`w-full text-left text-[10px] font-bold py-2 px-2.5 rounded-lg cursor-pointer transition-all ${timeUnit === "seconds" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Segundos</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-3">
                      <input placeholder="Nome da Operação" value={newOperationName} onKeyPress={handleKeyPress}
                        onChange={(e) => { setNewOperationName(e.target.value); if (errors.operationName) setErrors((prev) => ({ ...prev, operationName: undefined })); }}
                        className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                      <input type="number" step="0.01" min="0" placeholder="Tempo" value={newOperationTime} onKeyPress={handleKeyPress}
                        onChange={(e) => { setNewOperationTime(e.target.value); if (errors.operationTime) setErrors((prev) => ({ ...prev, operationTime: undefined })); }}
                        className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                      <button 
                        onClick={addOperation} disabled={!newOperationName.trim() || !newOperationTime.trim() || isLoading}
                        className="w-full h-12 flex items-center justify-center bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Adicionar
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleImportExcel} disabled={isLoading} className="flex-1 h-12 flex items-center justify-center bg-card border border-border text-muted-foreground font-bold text-xs rounded-xl hover:bg-muted transition-colors shadow-sm">
                      <Upload className="h-4 w-4 mr-2" /> Importar
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button disabled={isLoading} className="flex-1 h-12 flex items-center justify-center bg-card border border-border text-muted-foreground font-bold text-xs rounded-xl hover:bg-muted transition-colors shadow-sm">
                          <Download className="h-4 w-4 mr-2" /> Exportar
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 bg-card rounded-2xl shadow-xl border border-border p-2">
                        <DropdownMenuItem onClick={handleExportChartPDF} disabled={operations.length === 0} className="cursor-pointer text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted text-foreground">
                          <FileImage className="h-4 w-4 mr-2 text-destructive" /> Exportar Gráfico (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportExcel} disabled={operations.length === 0} className="cursor-pointer text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted text-foreground">
                          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Exportar Dados (Excel)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <button onClick={downloadTemplate} disabled={isLoading} className="w-full h-12 flex items-center justify-center bg-card border border-border text-muted-foreground font-bold text-xs rounded-xl hover:bg-muted transition-colors shadow-sm">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Baixar Modelo Padrão (Excel)
                  </button>

                  <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
                    <DraggableOperationsList operations={operations} timeUnit={timeUnit} onReorder={reorderOperations} onRemove={removeOperation} onEdit={editOperation} />
                  </div>
                </div>

                {/* COLUNA DIREITA: GRÁFICOS (65% ou 60% fluído) */}
                <div className="xl:w-[65%] flex flex-col gap-6 print:w-full">
                  {operations.length > 0 ? (
                    <>
                      <div className="print:hidden">
                        <CalculationsDashboard operations={operations} timeUnit={timeUnit} taktTime={calculateTaktTime()} taktTimeUnit={timeUnitTakt} demandUnit={demandUnit} />
                      </div>
                      
                      <div id="gbo-chart-container" className="bg-card rounded-3xl shadow-sm border border-border p-6 print:border-none print:shadow-none print:p-0">
                        <GBOChart operations={operations} timeUnit={timeUnit} taktTime={calculateTaktTime()} taktTimeUnit={timeUnitTakt} demandUnit={demandUnit} />
                      </div>
                    </>
                  ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-card border border-border rounded-2xl shadow-sm print:hidden">
                      <div className="p-4 rounded-full bg-input mb-4">
                        <Plus className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Nenhuma operação adicionada</h3>
                      <p className="text-sm text-muted-foreground mt-2">Preencha o formulário ao lado para gerar o gráfico</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pcp" className="outline-none">
              <PCPTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}

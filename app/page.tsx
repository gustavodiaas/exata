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
  Settings,
  Save
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
  
  const [productCode, setProductCode] = useState("")
  const [productName, setProductName] = useState("")
  const [calcType, setCalcType] = useState("takt")
  const [setupTime, setSetupTime] = useState("")

  const [newOperationName, setNewOperationName] = useState("")
  const [newOperationTime, setNewOperationTime] = useState("")
  const [errors, setErrors] = useState<{
    operationName?: string
    operationTime?: string
  }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // 1. Puxa os dados salvos quando a página carrega
  useEffect(() => {
    const savedSession = localStorage.getItem("gbo_active_session")
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        if (parsed.operations) setOperations(parsed.operations)
        if (parsed.productCode) setProductCode(parsed.productCode)
        if (parsed.productName) setProductName(parsed.productName)
        if (parsed.calcType) setCalcType(parsed.calcType)
        if (parsed.timeUnit) setTimeUnit(parsed.timeUnit)
        if (parsed.setupTime) setSetupTime(parsed.setupTime)
      } catch (e) {
        console.error("Erro ao ler sessão ativa")
      }
    }
    setIsLoaded(true)
  }, [])

  // 2. Salva os dados sempre que algo for alterado
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("gbo_active_session", JSON.stringify({
        operations,
        productCode,
        productName,
        calcType,
        timeUnit,
        setupTime
      }))
    }
  }, [operations, productCode, productName, calcType, timeUnit, setupTime, isLoaded])

  const totalCycleTime = operations.reduce((sum, op) => sum + op.time, 0)

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addOperation()
  }

  const handleSaveProduct = () => {
    if (!productCode.trim() || !productName.trim()) {
      toast({ title: "Erro de Cadastro", description: "O Código e o Nome do Produto são obrigatórios.", variant: "destructive" })
      return
    }
    if (operations.length === 0) {
      toast({ title: "Roteiro Vazio", description: "Adicione ao menos uma operação antes de salvar.", variant: "destructive" })
      return
    }

    const newProduct = {
      code: productCode.trim(),
      description: productName.trim(),
      setupTime: setupTime ? Number.parseFloat(setupTime) : 0,
      steps: operations.map(op => ({
        name: op.name,
        cycleTime: timeUnit === "minutes" ? op.time * 60 : op.time, // PCP lê em segundos
        setupTime: 0
      }))
    }

    const existingData = localStorage.getItem("gbo_products")
    let productsArray = existingData ? JSON.parse(existingData) : []
    
    const existingIndex = productsArray.findIndex((p: any) => p.code === newProduct.code)
    if (existingIndex >= 0) {
      productsArray[existingIndex] = newProduct
    } else {
      productsArray.push(newProduct)
    }

    localStorage.setItem("gbo_products", JSON.stringify(productsArray))
    
    window.dispatchEvent(new Event("sync_gbo_products"))
    
    toast({ title: "✅ Produto Salvo", description: "O roteiro foi sincronizado com o PCP Heijunka." })
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
                  Gerenciamento Diário Fácil
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <ThemeToggle />
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border rounded-2xl shadow-xl">
                  <DialogHeader>
                    <DialogTitle className="text-primary flex items-center gap-2 font-bold text-lg">
                      <HelpCircle className="w-5 h-5" />
                      Manual Técnico Gerenciamento Diário
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">Protocolo de Execução</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 text-sm mt-4 leading-relaxed text-justify text-foreground">
                    <p>O <strong>Gerenciamento Diário</strong> é uma rotina estruturada de acompanhamento e tomada de decisões para monitorar indicadores, identificar desvios e garantir o alcance das metas da organização..</p>
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
                  Cadastro de Produto
                </TabsTrigger>
                <TabsTrigger value="pcp" className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Programação e Controle de Produção
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="gbo" className="outline-none space-y-6">
              <div className="flex flex-col xl:flex-row gap-8 pb-12 print:p-0">
                
                <div className="xl:w-[35%] flex flex-col gap-6 print:hidden">
                  
                  <div className="bg-card p-6 rounded-2xl shadow-sm border border-border space-y-4">
                    <h3 className="font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      Identificação do Produto
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor="productCode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Código do Produto</label>
                          <input id="productCode" type="text" placeholder="Ex: PRD-001" value={productCode}
                            onChange={(e) => setProductCode(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="productName" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome do Produto</label>
                          <input id="productName" type="text" placeholder="Ex: Válvula de Retenção" value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor="calcTypeTrigger" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tipo de Cálculo</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button id="calcTypeTrigger" className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium text-foreground flex items-center justify-between outline-none hover:bg-muted transition-all focus:ring-2 focus:ring-primary">
                                {calcType === "takt" ? "Takt" : calcType === "media" ? "Média" : "Soma"}
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] bg-card border border-border p-2 rounded-2xl shadow-xl z-[150]">
                              <DropdownMenuItem onClick={() => setCalcType("takt")} className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${calcType === "takt" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Takt</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCalcType("media")} className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${calcType === "media" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Média</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCalcType("soma")} className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${calcType === "soma" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>Soma</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="totalCycleTime" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tempo de Ciclo</label>
                          <input 
                            id="totalCycleTime"
                            type="text" 
                            readOnly
                            value={`${totalCycleTime.toFixed(2)} ${timeUnit === "minutes" ? "min" : "seg"}`}
                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/50 text-muted-foreground text-sm outline-none cursor-not-allowed font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="setupTime" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tempo de Setup</label>
                          <div className="relative">
                            <input 
                              id="setupTime"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={setupTime}
                              onChange={(e) => setSetupTime(e.target.value)}
                              className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all pr-14"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                              {timeUnit === "minutes" ? "min" : "seg"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {operations.length > 0 && (
                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-3 mt-4">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <p className="text-sm font-semibold text-primary">
                            Tempo de Ciclo Total: {totalCycleTime.toFixed(2)} {timeUnit === "minutes" ? "min" : "seg"}
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
                          <button id="timeUnitTrigger" aria-label="Unidade de Tempo" className="h-8 px-3 rounded-lg bg-input border border-border text-[10px] font-bold text-muted-foreground flex items-center gap-1 outline-none hover:bg-muted transition-all focus:ring-2 focus:ring-primary">
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
                      <label htmlFor="newOperationName" className="sr-only">Nome da Operação</label>
                      <input id="newOperationName" placeholder="Nome da Operação" value={newOperationName} onKeyPress={handleKeyPress}
                        onChange={(e) => { setNewOperationName(e.target.value); if (errors.operationName) setErrors((prev) => ({ ...prev, operationName: undefined })); }}
                        className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                      <label htmlFor="newOperationTime" className="sr-only">Tempo da Operação</label>
                      <input id="newOperationTime" type="number" step="0.01" min="0" placeholder="Tempo" value={newOperationTime} onKeyPress={handleKeyPress}
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

                <div className="xl:w-[65%] flex flex-col gap-6 print:w-full">
                  {operations.length > 0 ? (
                    <>
                      <div className="print:hidden">
                        <CalculationsDashboard operations={operations} timeUnit={timeUnit} taktTime={undefined} taktTimeUnit={undefined} demandUnit="un" />
                      </div>
                      
                      <div id="gbo-chart-container" className="bg-card rounded-3xl shadow-sm border border-border p-6 print:border-none print:shadow-none print:p-0">
                        <GBOChart operations={operations} timeUnit={timeUnit} taktTime={undefined} taktTimeUnit={undefined} demandUnit="un" />
                      </div>

                      <div className="flex justify-end mt-2 print:hidden">
                        <Button 
                          onClick={handleSaveProduct} 
                          className="bg-primary hover:opacity-90 text-primary-foreground font-bold uppercase tracking-widest h-12 px-8 rounded-xl shadow-md transition-all"
                        >
                          <Save className="h-5 w-5 mr-2" />
                          Salvar Produto e Sincronizar PCP
                        </Button>
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

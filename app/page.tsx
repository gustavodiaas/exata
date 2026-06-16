"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { CalculationsDashboard } from "@/components/calculations-dashboard"
import { DraggableOperationsList } from "@/components/draggable-operations-list"
import { exportToExcel, importFromExcel, downloadTemplate } from "@/components/export-utils"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { GBOChart } from "@/components/gbo-chart"
import { PCPTab } from "@/components/pcp-tab"
import { ApontamentoTab } from "@/components/apontamento-tab"
import { DashboardTab } from "@/components/dashboard-tab"
import { useTheme } from "next-themes"
import { supabase } from "@/components/supabase"
import {
  Plus, Download, Upload, FileSpreadsheet, CheckCircle2,
  FileImage, ChevronDown, BarChart2, CalendarClock, Save, BookOpen,
  Pencil, Trash2, Menu, X, PanelLeftClose, PanelLeftOpen,
  Settings, Sun, Moon, Monitor, BookText, LogOut, ClipboardCheck, LayoutDashboard, User
} from "lucide-react"

interface Operation {
  id: string
  name: string
  time: number
  setupTime: number
  unit: "minutes" | "seconds"
}

const validateNumber = (value: string, min = 0): { isValid: boolean; error?: string } => {
  if (!value.trim()) return { isValid: false, error: "Campo obrigatório" }
  const num = Number.parseFloat(value)
  if (isNaN(num)) return { isValid: false, error: "Deve ser um número válido" }
  if (num < min) return { isValid: false, error: `Deve ser maior ou igual a ${min}` }
  return { isValid: true }
}

const validateText = (value: string): { isValid: boolean; error?: string } => {
  if (!value.trim()) return { isValid: false, error: "Campo obrigatório" }
  if (value.trim().length < 2) return { isValid: false, error: "Mínimo 2 caracteres" }
  return { isValid: true }
}

type TabId = "dashboard" | "gbo" | "pcp" | "apontamento" | "configuracoes"
type CalcType = "takt" | "media" | "soma"

const NAV_ITEMS: { id: TabId; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", sublabel: "Visão geral da fábrica", icon: LayoutDashboard },
  { id: "gbo", label: "Produto/Roteiro", sublabel: "Gerenciamento Diário", icon: BarChart2 },
  { id: "pcp", label: "PCP", sublabel: "Programação de Produção", icon: CalendarClock },
  { id: "apontamento", label: "Apontamento", sublabel: "Registro de Produção", icon: ClipboardCheck },
]

const NAV_BOTTOM: { id: TabId; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: "configuracoes", label: "Configurações", sublabel: "Preferências do sistema", icon: Settings },
]

export default function GBOAnalysis() {
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  
  const [empresaName, setEmpresaName] = useState("")
  const [defaultTime, setDefaultTime] = useState("")
  const [defaultTimeUnit, setDefaultTimeUnit] = useState<"hours" | "minutes" | "seconds">("hours")
  const [newPassword, setNewPassword] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [activeTab, setActiveTab] = useState<TabId>("gbo")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const [operations, setOperations] = useState<Operation[]>([])
  const [timeUnit, setTimeUnit] = useState<"minutes" | "seconds">("minutes")
  const [productCode, setProductCode] = useState("")
  const [productName, setProductName] = useState("")
  const [calcType, setCalcType] = useState<CalcType>("takt")
  const [newOperationName, setNewOperationName] = useState("")
  const [newOperationTime, setNewOperationTime] = useState("")
  const [newOperationSetup, setNewOperationSetup] = useState("")
  const [errors, setErrors] = useState<{ operationName?: string; operationTime?: string; operationSetup?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [savedProducts, setSavedProducts] = useState<Array<{ code: string; description: string; steps: Array<{ name: string; cycleTime: number; setupTime: number }> }>>([])
  const [showProductsPanel, setShowProductsPanel] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ product: any; index: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("perfis")
        .select("empresa, tempo_padrao, unidade_tempo")
        .eq("id", userId)
        .single()
        
      if (data) {
        setEmpresaName(data.empresa || "")
        setDefaultTime(data.tempo_padrao ? data.tempo_padrao.toString() : "")
        setDefaultTimeUnit(data.unidade_tempo || "hours")
      }
    } catch (e) {
      console.error("Erro ao carregar perfil")
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadUserProfile(session.user.id)
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadUserProfile(session.user.id)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadSavedProducts = async () => {
    try {
      const { data: prods, error } = await supabase
        .from("produtos")
        .select(`
          id,
          codigo,
          descricao,
          operacoes (nome, tempo, unidade, ordem)
        `)
        .order("ordem", { foreignTable: "operacoes" })

      if (error) throw error

      if (prods && prods.length === 0) {
        const dadosLocais = localStorage.getItem("gbo_products")
        if (dadosLocais) {
          const produtosLocais = JSON.parse(dadosLocais)
          if (produtosLocais.length > 0) {
            setSavedProducts(produtosLocais)
            toast({ title: "Migração Pendente", description: "Encontramos seus roteiros antigos. Carregue um por um e salve para jogar na nuvem de forma oficial." })
            return
          }
        }
      }

      if (prods) {
        const formatted = prods.map((p: any) => ({
          code: p.codigo,
          description: p.descricao,
          steps: (p.operacoes || []).sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((o: any) => ({
            name: o.nome,
            cycleTime: o.unidade === "minutes" ? o.tempo * 60 : o.tempo,
            setupTime: 0 
          }))
        }))
        setSavedProducts(formatted)
        localStorage.setItem("gbo_products", JSON.stringify(formatted))
      }
    } catch (e) {
      const data = localStorage.getItem("gbo_products")
      if (data) setSavedProducts(JSON.parse(data))
    }
  }

  useEffect(() => {
    setMounted(true)
    
    const savedTab = localStorage.getItem("exata_aba_ativa") as TabId
    if (savedTab && ["dashboard", "gbo", "pcp", "apontamento", "configuracoes"].includes(savedTab)) {
      setActiveTab(savedTab)
    }

    if (user) {
      const savedSession = localStorage.getItem(`exata_session_${user.id}`)
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession)
          if (parsed.operations) setOperations(parsed.operations)
          if (parsed.productCode) setProductCode(parsed.productCode)
          if (parsed.productName) setProductName(parsed.productName)
          if (parsed.calcType) setCalcType(parsed.calcType)
          if (parsed.timeUnit) setTimeUnit(parsed.timeUnit)
        } catch (e) {
          console.error("Erro ao ler rascunho")
        }
      }
      loadSavedProducts()
    }
    setIsLoaded(true)
    window.addEventListener("sync_gbo_products", loadSavedProducts)
    return () => window.removeEventListener("sync_gbo_products", loadSavedProducts)
  }, [user])

  useEffect(() => {
    if (isLoaded && user) {
      localStorage.setItem(`exata_session_${user.id}`, JSON.stringify({ operations, productCode, productName, calcType, timeUnit }))
    }
  }, [operations, productCode, productName, calcType, timeUnit, isLoaded, user])

  const totalCycleTime = useMemo(() => {
    if (operations.length === 0) return 0
    if (calcType === "soma") return operations.reduce((sum, op) => sum + op.time, 0)
    if (calcType === "media") return operations.reduce((sum, op) => sum + op.time, 0) / operations.length
    if (calcType === "takt") return Math.max(...operations.map((op) => op.time))
    return 0
  }, [operations, calcType])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setIsLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoginError("Credenciais inválidas ou acesso não autorizado.")
      setIsLoading(false)
      return
    }

    const { data: perfil } = await supabase.from("perfis").select("status").eq("id", data.user?.id).single()
    if (perfil && perfil.status === "inativo") {
      setLoginError("Sua assinatura está suspensa. Entre em contato com o administrador.")
      await supabase.auth.signOut()
      setIsLoading(false)
      return
    }

    setUser(data.user)
    setIsLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    try {
      const { error: profileError } = await supabase
        .from("perfis")
        .upsert({
          id: user.id,
          empresa: empresaName.trim(),
          tempo_padrao: defaultTime ? parseFloat(defaultTime) : null,
          unidade_tempo: defaultTimeUnit
        }, { onConflict: "id" })

      if (profileError) throw profileError

      if (newPassword.trim().length > 0) {
        if (newPassword.length < 6) {
          toast({ title: "Senha fraca", description: "Use pelo menos 6 caracteres.", variant: "destructive" })
          setIsSavingProfile(false)
          return
        }
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
        if (authError) throw authError
        setNewPassword("")
      }

      toast({ title: "✅ Perfil Atualizado", description: "Seus dados foram gravados na nuvem." })
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const addOperation = () => {
    const nameValidation = validateText(newOperationName)
    const timeValidation = validateNumber(newOperationTime)
    const setupValidation = validateNumber(newOperationSetup)
    const newErrors: typeof errors = {}
    
    if (!nameValidation.isValid) newErrors.operationName = nameValidation.error
    if (!timeValidation.isValid) newErrors.operationTime = timeValidation.error
    if (!setupValidation.isValid) newErrors.operationSetup = setupValidation.error
    
    setErrors(newErrors)
    
    if (!nameValidation.isValid || !timeValidation.isValid || !setupValidation.isValid) {
      toast({ title: "Dados inválidos", description: "Verifique os campos destacados.", variant: "destructive" })
      return
    }
    
    const token = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const newOperation: Operation = {
      id: token,
      name: newOperationName.trim(),
      time: Number.parseFloat(newOperationTime),
      setupTime: Number.parseFloat(newOperationSetup),
      unit: timeUnit,
    }
    
    setOperations([...operations, newOperation])
    setNewOperationName("")
    setNewOperationTime("")
    setNewOperationSetup("")
    setErrors({})
    toast({ title: "✅ Operação adicionada", description: `"${newOperation.name}" foi adicionada.` })
  }

  const removeOperation = (id: string) => {
    const operation = operations.find((op) => op.id === id)
    setOperations(operations.filter((op) => op.id !== id))
    if (operation) toast({ title: "Operação removida", description: `"${operation.name}" foi removida.` })
  }

  const editOperation = (id: string, newName: string, newTime: number) => {
    setOperations(operations.map((op) => (op.id === id ? { ...op, name: newName, time: newTime } : op)))
    toast({ title: "✅ Atualizado", description: `Operação "${newName}" atualizada.` })
  }

  const reorderOperations = (newOperations: Operation[]) => {
    setOperations(newOperations)
    toast({ title: "✅ Ordem atualizada", description: "A ordem das operações foi reorganizada." })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addOperation()
  }

  const buildNewProduct = () => ({
    code: productCode.trim(),
    description: productName.trim(),
    steps: operations.map((op) => ({
      name: op.name,
      cycleTime: timeUnit === "minutes" ? op.time * 60 : op.time,
      setupTime: timeUnit === "minutes" ? (op.setupTime || 0) * 60 : (op.setupTime || 0),
    })),
  })

  const commitSaveProduct = async (product: ReturnType<typeof buildNewProduct>) => {
    setIsLoading(true)
    try {
      const { data: prodData, error: prodError } = await supabase
        .from("produtos")
        .upsert({ user_id: user.id, codigo: product.code, descricao: product.description }, { onConflict: "user_id,codigo" })
        .select()
        .single()

      if (prodError) throw prodError

      await supabase.from("operacoes").delete().eq("produto_id", prodData.id)

      const opsToInsert = operations.map((op, index) => ({
        produto_id: prodData.id,
        ordem: index + 1,
        nome: op.name,
        tempo: op.time,
        unidade: op.unit
      }))

      const { error: opsError } = await supabase.from("operacoes").insert(opsToInsert)
      if (opsError) throw opsError

      const existingData = localStorage.getItem("gbo_products")
      let productsArray = existingData ? JSON.parse(existingData) : []
      const existingIndex = productsArray.findIndex((p: any) => p.code === product.code)
      if (existingIndex >= 0) productsArray[existingIndex] = product
      else productsArray.push(product)
      localStorage.setItem("gbo_products", JSON.stringify(productsArray))

      window.dispatchEvent(new Event("sync_gbo_products"))
      await loadSavedProducts()
      setConfirmOverwrite(null)
      toast({ title: "✅ Sincronizado na Nuvem", description: "O roteiro está salvo e disponível no ecossistema Exata." })
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
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
    const newProduct = buildNewProduct()
    const existingIndex = savedProducts.findIndex((p: any) => p.code === newProduct.code)
    if (existingIndex >= 0) {
      setConfirmOverwrite({ product: newProduct, index: existingIndex })
      return
    }
    commitSaveProduct(newProduct)
  }

  const handleLoadProduct = (product: typeof savedProducts[0]) => {
    const seed = Date.now()
    const ops = product.steps.map((step, i) => ({
      id: `${seed}-${Math.random().toString(36).substring(2, 7)}-${i}`,
      name: step.name,
      time: timeUnit === "minutes" ? step.cycleTime / 60 : step.cycleTime,
      setupTime: timeUnit === "minutes" ? step.setupTime / 60 : step.setupTime,
      unit: timeUnit,
    }))
    setProductCode(product.code)
    setProductName(product.description)
    setOperations(ops)
    setShowProductsPanel(false)
    toast({ title: "✅ Produto Carregado", description: `Roteiro "${product.description}" carregado para edição.` })
  }

  const handleDeleteProduct = async (code: string) => {
    try {
      await supabase.from("produtos").delete().eq("codigo", code).eq("user_id", user.id)
      const updated = savedProducts.filter((p: any) => p.code !== code)
      setSavedProducts(updated)
      localStorage.setItem("gbo_products", JSON.stringify(updated))
      window.dispatchEvent(new Event("sync_gbo_products"))
      toast({ title: "Produto Removido", description: `O roteiro "${code}" foi excluído da nuvem.` })
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" })
    }
  }

  const handleExportExcel = async () => {
    if (operations.length === 0) return
    setIsLoading(true)
    try {
      await exportToExcel(operations, timeUnit)
      toast({ title: "✅ Excel exportado", description: "A planilha foi baixada." })
    } catch {
      toast({ title: "❌ Erro", description: "Falha ao exportar Excel.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportChartPDF = () => {
    if (operations.length === 0) return
    setTimeout(() => window.print(), 300)
  }

  const handleImportExcel = () => fileInputRef.current?.click()

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
    } catch {
      toast({ title: "❌ Erro", description: "Falha na importação.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Carregando Exata...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm border border-border/50 bg-card p-8 shadow-2xl rounded-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Exata</h1>
            <p className="text-xs text-muted-foreground font-medium">Controle de acesso para contas cadastradas</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">E-mail Corporativo</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="nome@empresa.com" />
            </div>
            <div className="space-y-1">
              <label htmlFor="pass" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Senha</label>
              <input id="pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="••••••••" />
            </div>
            {loginError && <p className="text-xs font-bold text-destructive text-center bg-destructive/10 p-2 rounded-lg">{loginError}</p>}
            <button type="submit" disabled={isLoading} className="w-full h-12 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded-xl shadow-md hover:opacity-90 transition-all">
              {isLoading ? "Validando Acesso..." : "Entrar no Sistema"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          [data-radix-toast-provider], [role="region"][aria-label="Notifications"], .toaster, [data-radix-popper-content-wrapper] {
            display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;
          }
        }
        .sidebar-transition { transition: width 200ms cubic-bezier(0.4,0,0.2,1); }
        
        /* Remove as setas dos inputs de número em todos os navegadores */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      ` }} />

      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Código já existe</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Já existe um produto com o código <span className="font-bold text-foreground">"{confirmOverwrite.product.code}"</span>. Deseja substituir o roteiro salvo pelo atual?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmOverwrite(null)}
                className="flex-1 h-10 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => commitSaveProduct(confirmOverwrite.product)}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-colors"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-screen overflow-hidden bg-background flex print:block">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />

        <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-card border-r border-border sidebar-transition print:hidden ${collapsed ? "w-[68px]" : "w-60"}`}>
          <div className={`flex items-center border-b border-border h-[65px] px-3 ${collapsed ? "justify-center" : "justify-between px-4"}`}>
            {!collapsed && (
              <div className="min-w-0 pr-2">
                <p className="text-sm font-black text-foreground tracking-tight leading-tight whitespace-nowrap uppercase">EXATA</p>
                <p className="text-[10px] text-muted-foreground truncate">Olá, <span className="font-bold text-primary">{empresaName || "Operador"}</span></p>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 px-2 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.sublabel : undefined}
                  className={`
                    w-full flex items-center rounded-xl transition-all text-left
                    ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"}
                    ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                  `}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {item.sublabel}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="px-2 py-3 border-t border-border space-y-1">
            {NAV_BOTTOM.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.sublabel : undefined}
                  className={`
                    w-full flex items-center rounded-xl transition-all text-left
                    ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"}
                    ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                  `}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {item.sublabel}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
            <button onClick={handleLogout} className={`w-full flex items-center rounded-xl text-destructive hover:bg-destructive/10 transition-all ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"}`} title={collapsed ? "Sair do sistema" : undefined}>
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-xs font-bold leading-tight">Sair do Sistema</span>}
            </button>
            {!collapsed && (
              <p className="text-[9px] text-muted-foreground/50 font-medium text-center pt-2 pb-1">v3.0.0 Cloud</p>
            )}
          </div>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out lg:hidden print:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-5 h-[65px] border-b border-border">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-black text-foreground tracking-tight uppercase">EXATA</p>
              <p className="text-[10px] text-muted-foreground truncate">Olá, <span className="font-bold text-primary">{empresaName || "Operador"}</span></p>
            </div>
            <button onClick={() => setMobileOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold leading-tight">{item.label}</span>
                    <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.sublabel}</span>
                  </div>
                </button>
              )
            })}
          </nav>
          <div className="px-3 py-3 border-t border-border space-y-1">
            {NAV_BOTTOM.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold leading-tight">{item.label}</span>
                    <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.sublabel}</span>
                  </div>
                </button>
              )
            })}
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-destructive hover:bg-destructive/10 transition-all">
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-bold">Sair do Sistema</span>
            </button>
            <p className="text-[9px] text-muted-foreground/50 font-medium text-center pt-2">v3.0.0 Cloud</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 print:w-full overflow-hidden">
          <div className="lg:hidden flex items-center px-4 pt-4 pb-0 print:hidden">
            <button onClick={() => setMobileOpen(true)} className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors">
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <main className="flex-1 overflow-auto px-4 lg:px-8 py-6 print:p-12">
            
            {activeTab === "gbo" && (
              <div className="flex flex-col xl:flex-row gap-8 pb-12 print:p-0 animate-in fade-in duration-300">
                <div className="xl:w-[35%] flex flex-col gap-6 print:hidden">
                  <div className="bg-card p-6 rounded-2xl shadow-sm border border-border space-y-4">
                    <h3 className="font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Identificação do Produto
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Código</label>
                          <input type="text" placeholder="Ex: PRD-001" value={productCode} onChange={(e) => setProductCode(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome</label>
                          <input type="text" placeholder="Ex: Válvula" value={productName} onChange={(e) => setProductName(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tipo de Cálculo</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium text-foreground flex items-center justify-between outline-none hover:bg-muted transition-all focus:ring-2 focus:ring-primary">
                                {calcType === "takt" ? "Takt" : calcType === "media" ? "Média" : "Soma"}
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] bg-card border border-border p-2 rounded-2xl shadow-xl z-[150]">
                              {["takt", "media", "soma"].map((c) => (
                                <DropdownMenuItem key={c} onClick={() => setCalcType(c as CalcType)}
                                  className={`w-full text-left text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer transition-all ${calcType === c ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                                  {c === "takt" ? "Takt" : c === "media" ? "Média" : "Soma"}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tempo de Ciclo</label>
                          <input type="text" readOnly value={`${totalCycleTime.toFixed(2)} ${timeUnit === "minutes" ? "min" : "seg"}`}
                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/50 text-muted-foreground text-sm outline-none cursor-not-allowed font-semibold" />
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

                  {savedProducts.length > 0 && (
                    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                      <button onClick={() => setShowProductsPanel(!showProductsPanel)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="font-bold text-foreground text-sm">Produtos na Nuvem</span>
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{savedProducts.length}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showProductsPanel ? "rotate-180" : ""}`} />
                      </button>
                      {showProductsPanel && (
                        <div className="border-t border-border divide-y divide-border max-h-[280px] overflow-y-auto">
                          {savedProducts.map((product) => (
                            <div key={product.code} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-xs font-bold text-foreground truncate">{product.description}</span>
                                <span className="text-[10px] text-muted-foreground">{product.code} · {product.steps.length} operações</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                <button onClick={() => handleLoadProduct(product)} title="Carregar para edição"
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDeleteProduct(product.code)} title="Excluir produto"
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-card p-6 rounded-2xl shadow-sm border border-border space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h3 className="font-bold text-foreground text-sm tracking-wide uppercase">Nova Operação</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 px-3 rounded-lg bg-input border border-border text-[10px] font-bold text-muted-foreground flex items-center gap-1 outline-none hover:bg-muted transition-all">
                            {timeUnit === "minutes" ? "Minutos" : "Segundos"} <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32 bg-card border border-border p-1.5 rounded-xl shadow-xl z-[150]">
                          {(["minutes", "seconds"] as const).map((u) => (
                            <DropdownMenuItem key={u} onClick={() => setTimeUnit(u)}
                              className={`w-full text-left text-[10px] font-bold py-2 px-2.5 rounded-lg cursor-pointer transition-all ${timeUnit === u ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                              {u === "minutes" ? "Minutos" : "Segundos"}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-3">
                      <input placeholder="Nome da Operação" value={newOperationName} onKeyPress={handleKeyPress}
                        onChange={(e) => { setNewOperationName(e.target.value); if (errors.operationName) setErrors((p) => ({ ...p, operationName: undefined })) }}
                        className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                      <input type="number" step="0.01" min="0" placeholder="Tempo de Ciclo" value={newOperationTime} onKeyPress={handleKeyPress}
                        onChange={(e) => { setNewOperationTime(e.target.value); if (errors.operationTime) setErrors((p) => ({ ...p, operationTime: undefined })) }}
                        className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                      <input type="number" step="0.01" min="0" placeholder="Tempo de Setup" value={newOperationSetup} onKeyPress={handleKeyPress}
                        onChange={(e) => { setNewOperationSetup(e.target.value); if (errors.operationSetup) setErrors((p) => ({ ...p, operationSetup: undefined })) }}
                        className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                      <button onClick={addOperation} disabled={!newOperationName.trim() || !newOperationTime.trim() || !newOperationSetup.trim() || isLoading}
                        className="w-full h-12 flex items-center justify-center bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
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
                    <React.Fragment>
                      <div className="print:hidden">
                        <CalculationsDashboard operations={operations} timeUnit={timeUnit} taktTime={calcType === "takt" && operations.length > 0 ? (timeUnit === "minutes" ? totalCycleTime * 60 : totalCycleTime) : undefined} taktTimeUnit="seconds" demandUnit="un" />
                      </div>
                      <div id="gbo-chart-container" className="bg-card rounded-3xl shadow-sm border border-border p-6 print:border-none print:shadow-none print:p-0">
                        <GBOChart operations={operations} timeUnit={timeUnit} taktTime={calcType === "takt" && operations.length > 0 ? (timeUnit === "minutes" ? totalCycleTime * 60 : totalCycleTime) : undefined} taktTimeUnit="seconds" demandUnit="un" />
                      </div>
                      <div className="flex justify-end mt-2 print:hidden">
                        <Button onClick={handleSaveProduct} disabled={isLoading} className="bg-primary hover:opacity-90 text-primary-foreground font-bold uppercase tracking-widest h-12 px-8 rounded-xl shadow-md transition-all">
                          <Save className="h-5 w-5 mr-2" /> {isLoading ? "Sincronizando..." : "Salvar e Sincronizar Nuvem"}
                        </Button>
                      </div>
                    </React.Fragment>
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
            )}

            {activeTab === "dashboard" && (
              <div className="animate-in fade-in duration-300">
                <DashboardTab />
              </div>
            )}

            {activeTab === "pcp" && (
              <div className="animate-in fade-in duration-300">
                <PCPTab />
              </div>
            )}

            {activeTab === "apontamento" && (
              <div className="animate-in fade-in duration-300">
                <ApontamentoTab />
              </div>
            )}

            {activeTab === "configuracoes" && (
              <div className="space-y-8 pb-12 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Configurações</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Preferências e personalização do sistema</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                  {/* Coluna esquerda */}
                  <div className="space-y-6">

                    {/* Perfil de Usuário Unificado */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Perfil da Conta</h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Identificação e regras operacionais padrão</p>
                        </div>
                      </div>
                      <div className="p-6 space-y-5">
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Empresa / Empresário</label>
                          <input 
                            type="text" 
                            placeholder="Nome do seu negócio ou responsável" 
                            value={empresaName}
                            onChange={(e) => setEmpresaName(e.target.value)}
                            className="w-full h-10 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tempo Operacional Padrão</label>
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              placeholder="Ex: 8" 
                              value={defaultTime}
                              onChange={(e) => setDefaultTime(e.target.value)}
                              className="flex-1 h-10 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                            />
                            <select 
                              value={defaultTimeUnit} 
                              onChange={(e: any) => setDefaultTimeUnit(e.target.value)}
                              className="w-32 h-10 px-3 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                            >
                              <option value="hours">Horas</option>
                              <option value="minutes">Minutos</option>
                              <option value="seconds">Segundos</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nova Senha de Acesso</label>
                          <input 
                            type="password" 
                            placeholder="Deixe em branco para manter a atual (Mín. 6 caracteres)" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full h-10 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                          />
                        </div>

                        <button 
                          onClick={handleSaveProfile} 
                          disabled={isSavingProfile}
                          className="w-full h-11 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[11px] rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50 mt-2"
                        >
                          {isSavingProfile ? "Gravando Dados..." : "Salvar Configurações da Conta"}
                        </button>
                      </div>
                    </div>

                    {/* Aparência */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground">Aparência</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Escolha como o sistema é exibido na sua tela</p>
                      </div>
                      <div className="p-6 space-y-3">
                        {mounted && (
                          <React.Fragment>
                            {[
                              { value: "light", label: "Claro", description: "Fundo branco, ideal para ambientes iluminados", icon: Sun },
                              { value: "dark", label: "Escuro", description: "Fundo escuro, reduz fadiga visual à noite", icon: Moon },
                              { value: "system", label: "Sistema", description: "Segue automaticamente as configurações do seu dispositivo", icon: Monitor },
                            ].map(({ value, label, description, icon: Icon }) => (
                              <button key={value} onClick={() => setTheme(value)}
                                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all text-left ${theme === value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"}`}>
                                <div className={`h-9 w-9 flex items-center justify-center rounded-lg flex-shrink-0 ${theme === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-bold ${theme === value ? "text-primary" : "text-foreground"}`}>{label}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
                                </div>
                                <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all ${theme === value ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                  {theme === value && <div className="h-full w-full rounded-full bg-primary-foreground scale-50" />}
                                </div>
                              </button>
                            ))}
                          </React.Fragment>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Coluna direita — Manual Técnico */}
                  <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <BookText className="h-4 w-4 text-primary" /> Manual Técnico
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Protocolo de execução e instruções de uso</p>
                    </div>
                    <div className="p-6 space-y-5 text-sm leading-relaxed text-foreground">
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Produto/Roteiro — Gerenciamento Diário</p>
                        <p className="text-sm text-foreground/80">O Gerenciamento Diário é uma rotina estruturada de acompanhamento e tomada de decisões para monitorar indicadores, identificar desvios e garantir o alcance das metas da organização. Cadastre o produto, adicione as operações com seus tempos de ciclo e salve para sincronizar com o PCP.</p>
                      </div>
                      <div className="border-t border-border pt-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">PCP — Programação de Produção</p>
                        <p className="text-sm text-foreground/80">O módulo PCP utiliza a lógica Heijunka para nivelar a carga de produção. Após salvar um produto no GBO, crie ordens de produção, configure capacidades por turno e visualize o fluxo programado no quadro de nivelamento.</p>
                      </div>
                      <div className="border-t border-border pt-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Exceções de Capacidade</p>
                        <p className="text-sm text-foreground/80">Use o Gerenciamento de Exceções no PCP para configurar dias com capacidade diferenciada, como feriados, manutenções programadas ou turnos reduzidos. As exceções ficam listadas e podem ser removidas a qualquer momento.</p>
                      </div>
                      <div className="border-t border-border pt-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Produtos Salvos</p>
                        <p className="text-sm text-foreground/80">Produtos cadastrados no GBO ficam salvos e acessíveis pelo painel "Produtos Salvos". Use o lápis para carregar um roteiro existente para edição ou a lixeira para excluir. O código do produto é único — salvar com o mesmo código exige confirmação.</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </React.Fragment>
  )
}

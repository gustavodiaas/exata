"use client"

import React, { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"
import { GBOTab } from "@/components/gbo-tab"
import { PCPTab } from "@/components/pcp-tab"
import { ApontamentoTab } from "@/components/apontamento-tab"
import { ExcecoesTab } from "@/components/excecoes-tab"
import { EstoqueTab } from "@/components/estoque-tab"
import { RelatoriosTab } from "@/components/relatorios-tab"
import { MaquinasTab } from "@/components/maquinas-tab"
import { ManutencaoTab } from "@/components/manutencao-tab"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import {
  Settings, Sun, Moon, Monitor, BookText, BarChart2, ClipboardCheck,
  CalendarClock, Menu, X, PanelLeftClose, PanelLeftOpen, Factory, Wrench, Key,
  Copy, Check, Eye, EyeOff, Tag, Boxes, LineChart
} from "lucide-react"

type TabId = "gbo" | "pcp" | "apontamento" | "maquinas" | "manutencao" | "excecoes" | "estoque" | "relatorios" | "configuracoes"

const NAV_ITEMS: { id: TabId; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: "gbo",        label: "Produto/Roteiro", sublabel: "Gerenciamento Diário",    icon: BarChart2      },
  { id: "pcp",        label: "PCP",             sublabel: "Programação de Produção",  icon: CalendarClock  },
  { id: "maquinas",   label: "Máquinas",         sublabel: "Postos de Trabalho",      icon: Factory        },
  { id: "manutencao", label: "Manutenção",        sublabel: "Gestão de Ativos",        icon: Wrench         },
  { id: "apontamento",label: "Apontamento",       sublabel: "Registro de Produção",    icon: ClipboardCheck },
  { id: "estoque",    label: "Estoque",           sublabel: "Controle de Inventário",  icon: Boxes          },
  { id: "excecoes",   label: "Exceções",          sublabel: "Motivos de Parada",       icon: Tag            },
  { id: "relatorios", label: "Relatórios",        sublabel: "Análise de Desempenho",   icon: LineChart      },
]

const STORAGE_KEY = "exata_empresa_id"
const STORAGE_TAB  = "exata_aba_ativa"

export default function ExataApp() {
  const [empresaAtivaId, setEmpresaAtivaId] = useState<string | null>(null)
  const [empresaName,    setEmpresaName]    = useState("")
  const [authLoading,    setAuthLoading]    = useState(true)

  // tela de código
  const [codigoInput,  setCodigoInput]  = useState("")
  const [codigoError,  setCodigoError]  = useState("")
  const [isChecking,   setIsChecking]   = useState(false)

  // nova fábrica
  const [showNova,     setShowNova]     = useState(false)
  const [nomeNova,     setNomeNova]     = useState("")
  const [isCriando,    setIsCriando]    = useState(false)

  // tela de confirmação do código recém-criado
  const [codigoNovo,   setCodigoNovo]   = useState<string | null>(null)
  const [copiado,      setCopiado]      = useState(false)

  // código visível nas configurações
  const [codigoAtual,  setCodigoAtual]  = useState<string | null>(null)
  const [showCodigo,   setShowCodigo]   = useState(false)
  const [copiadoConf,  setCopiadoConf]  = useState(false)

  // configurações
  const [defaultTime,     setDefaultTime]     = useState("")
  const [defaultTimeUnit, setDefaultTimeUnit] = useState<"hours" | "minutes" | "seconds">("hours")
  const [isSavingConf,    setIsSavingConf]    = useState(false)

  const [activeTab,    setActiveTab]    = useState<TabId>("gbo")
  const [collapsed,    setCollapsed]    = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [mounted,      setMounted]      = useState(false)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  // --- Inicialização ---
  useEffect(() => {
    setMounted(true)
    const savedId  = localStorage.getItem(STORAGE_KEY)
    const savedTab = localStorage.getItem(STORAGE_TAB) as TabId
    if (savedTab && NAV_ITEMS.find(n => n.id === savedTab)) setActiveTab(savedTab)

    if (savedId) {
      // Valida que a empresa ainda existe e busca o código
      supabase
        .from("empresas")
        .select("id, nome")
        .eq("id", savedId)
        .single()
        .then(async ({ data }) => {
          if (data) {
            setEmpresaAtivaId(data.id)
            setEmpresaName(data.nome)
            // busca o código da fábrica para exibir nas configurações
            const { data: cod } = await supabase
              .from("codigos_acesso")
              .select("codigo")
              .eq("empresa_id", data.id)
              .single()
            if (cod) setCodigoAtual(cod.codigo)
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
          setAuthLoading(false)
        })
    } else {
      setAuthLoading(false)
    }
  }, [])

  // --- Entrar com código ---
  const handleCodigo = async () => {
    if (!codigoInput.trim()) return
    setIsChecking(true)
    setCodigoError("")

    const { data, error } = await supabase
      .from("codigos_acesso")
      .select("empresa_id, empresas(id, nome)")
      .eq("codigo", codigoInput.trim())
      .single()

    if (error || !data) {
      setCodigoError("Código não encontrado. Verifique e tente novamente.")
      setIsChecking(false)
      return
    }

    const emp = data.empresas as any
    localStorage.setItem(STORAGE_KEY, emp.id)
    setEmpresaAtivaId(emp.id)
    setEmpresaName(emp.nome)

    // busca código para configurações
    const { data: cod } = await supabase
      .from("codigos_acesso")
      .select("codigo")
      .eq("empresa_id", emp.id)
      .single()
    if (cod) setCodigoAtual(cod.codigo)

    setIsChecking(false)
  }

  // --- Criar nova fábrica ---
  const handleCriarFabrica = async () => {
    if (!nomeNova.trim()) return
    setIsCriando(true)

    // 1. Cria a empresa
    const { data: emp, error: empError } = await supabase
      .from("empresas")
      .insert({ nome: nomeNova.trim() })
      .select("id, nome")
      .single()

    if (empError || !emp) {
      toast({ title: "Erro ao criar fábrica", description: empError?.message, variant: "destructive" })
      setIsCriando(false)
      return
    }

    // 2. Gera código alfanumérico de 6 chars sem ambiguidade
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let codigo = ""
    for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)]

    const { error: codError } = await supabase
      .from("codigos_acesso")
      .insert({ codigo, empresa_id: emp.id })

    if (codError) {
      toast({ title: "Fábrica criada, mas erro ao gerar código", description: codError.message, variant: "destructive" })
    }

    localStorage.setItem(STORAGE_KEY, emp.id)
    setEmpresaAtivaId(emp.id)
    setEmpresaName(emp.nome)
    setCodigoAtual(codigo)
    setCodigoNovo(codigo)  // dispara tela de confirmação
    setShowNova(false)
    setNomeNova("")
    setIsCriando(false)
  }

  // --- Sair (limpa localStorage) ---
  const handleSair = () => {
    localStorage.removeItem(STORAGE_KEY)
    setEmpresaAtivaId(null)
    setEmpresaName("")
    setCodigoAtual(null)
    setCodigoNovo(null)
  }

  // --- Salvar configurações ---
  const handleSaveConf = async () => {
    if (!empresaAtivaId) return
    setIsSavingConf(true)
    const { error } = await supabase
      .from("empresas")
      .update({
        tempo_padrao: defaultTime ? parseFloat(defaultTime) : null,
        unidade_tempo: defaultTimeUnit,
      })
      .eq("id", empresaAtivaId)

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "✅ Configurações salvas" })
    }
    setIsSavingConf(false)
  }

  // ----------------------------------------------------------------
  // TELA DE CARREGAMENTO
  // ----------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Carregando Exata...</p>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // TELA DE ACESSO (sem empresa ativa)
  // ----------------------------------------------------------------
  if (!empresaAtivaId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm border border-border/50 bg-card p-8 shadow-2xl rounded-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Exata</h1>
            <p className="text-xs text-muted-foreground font-medium">Sistema de controle industrial</p>
          </div>

          {!showNova ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
                  Código da Fábrica
                </label>
                <input
                  type="text"
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleCodigo()}
                  className="w-full h-14 px-4 rounded-xl border border-border bg-input text-foreground text-xl outline-none focus:ring-2 focus:ring-primary transition-all tracking-[0.3em] font-black text-center uppercase"
                  placeholder="MX7K2P"
                  maxLength={10}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {codigoError && (
                <p className="text-xs font-bold text-destructive text-center bg-destructive/10 p-2 rounded-lg">
                  {codigoError}
                </p>
              )}
              <button
                onClick={handleCodigo}
                disabled={isChecking}
                className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Key className="h-4 w-4" />
                {isChecking ? "Verificando..." : "Acessar Fábrica"}
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-[10px] text-muted-foreground uppercase tracking-widest">ou</span>
                </div>
              </div>
              <button
                onClick={() => setShowNova(true)}
                className="w-full h-12 flex items-center justify-center border border-border text-foreground font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-muted transition-all"
              >
                Criar Nova Fábrica
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
                  Nome da Fábrica
                </label>
                <input
                  type="text"
                  value={nomeNova}
                  onChange={(e) => setNomeNova(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCriarFabrica()}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Ex: Indústria Martins"
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center px-2">
                Um código de 6 caracteres será gerado. Anote-o — é a única forma de acessar sua fábrica.
              </p>
              <button
                onClick={handleCriarFabrica}
                disabled={isCriando || !nomeNova.trim()}
                className="w-full h-12 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isCriando ? "Criando..." : "Criar e Entrar"}
              </button>
              <button
                onClick={() => { setShowNova(false); setNomeNova("") }}
                className="w-full h-10 flex items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-widest hover:text-foreground transition-colors"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-6">Exata © 2026</p>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // APP PRINCIPAL
  // ----------------------------------------------------------------

  // helpers de cópia
  const copiarCodigo = (codigo: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(codigo).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2000)
    })
  }
  const NavButton = ({
    id, label, sublabel, icon: Icon, onClick, isActive, isCollapsed
  }: {
    id: string; label: string; sublabel: string; icon: React.ElementType;
    onClick: () => void; isActive: boolean; isCollapsed: boolean
  }) => (
    <button
      onClick={onClick}
      title={isCollapsed ? sublabel : undefined}
      className={`w-full flex items-center rounded-xl transition-all text-left
        ${isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"}
        ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      {!isCollapsed && (
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold leading-tight">{label}</span>
          <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {sublabel}
          </span>
        </div>
      )}
    </button>
  )

  const goTab = (tab: TabId) => {
    setActiveTab(tab)
    localStorage.setItem(STORAGE_TAB, tab)
    setMobileOpen(false)
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
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      ` }} />

      <div className="h-screen overflow-hidden bg-background flex print:block">

        {/* SIDEBAR DESKTOP */}
        <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-card border-r border-border sidebar-transition print:hidden ${collapsed ? "w-[68px]" : "w-60"}`}>
          <div className={`flex items-center border-b border-border h-[65px] px-3 ${collapsed ? "justify-center" : "justify-between px-4"}`}>
            {!collapsed && (
              <div className="min-w-0 pr-2">
                <p className="text-sm font-black text-foreground tracking-tight leading-tight whitespace-nowrap uppercase">EXATA</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  <span className="font-bold text-primary">{empresaName}</span>
                </p>
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
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                {...item}
                isActive={activeTab === item.id}
                isCollapsed={collapsed}
                onClick={() => goTab(item.id)}
              />
            ))}
          </nav>

          <div className="px-2 py-3 border-t border-border space-y-1">
            <NavButton
              id="configuracoes"
              label="Configurações"
              sublabel="Preferências do sistema"
              icon={Settings}
              isActive={activeTab === "configuracoes"}
              isCollapsed={collapsed}
              onClick={() => goTab("configuracoes")}
            />
            <button
              onClick={handleSair}
              className={`w-full flex items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all
                ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"}`}
              title={collapsed ? "Trocar fábrica" : undefined}
            >
              <Key className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-xs font-bold leading-tight">Trocar Fábrica</span>}
            </button>
            {!collapsed && (
              <p className="text-[9px] text-muted-foreground/50 font-medium text-center pt-2 pb-1">
                Construído para quem valoriza a precisão. Exata © 2026
              </p>
            )}
          </div>
        </aside>

        {/* OVERLAY MOBILE */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* SIDEBAR MOBILE */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out lg:hidden print:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-5 h-[65px] border-b border-border">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-black text-foreground tracking-tight uppercase">EXATA</p>
              <p className="text-[10px] text-muted-foreground truncate">
                <span className="font-bold text-primary">{empresaName}</span>
              </p>
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
                <button
                  key={item.id}
                  onClick={() => goTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all
                    ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold leading-tight">{item.label}</span>
                    <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {item.sublabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </nav>

          <div className="px-3 py-3 border-t border-border space-y-1">
            <button
              onClick={() => goTab("configuracoes")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all
                ${activeTab === "configuracoes" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold leading-tight">Configurações</span>
                <span className={`text-[10px] leading-tight truncate ${activeTab === "configuracoes" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  Preferências do sistema
                </span>
              </div>
            </button>
            <button
              onClick={handleSair}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <Key className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-bold">Trocar Fábrica</span>
            </button>
            <p className="text-[9px] text-muted-foreground/50 font-medium text-center pt-2">v4.0.0 Cloud</p>
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 flex flex-col min-w-0 print:w-full overflow-hidden">
          <div className="lg:hidden flex items-center px-4 pt-4 pb-0 print:hidden">
            <button onClick={() => setMobileOpen(true)} className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors">
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <main className="flex-1 overflow-auto px-4 lg:px-8 py-6 print:p-12">

            {empresaAtivaId && activeTab !== "configuracoes" && (
              <OnboardingChecklist
                empresaAtivaId={empresaAtivaId}
                onGoToTab={(tab) => goTab(tab as any)}
              />
            )}

            {activeTab === "gbo" && (
              <div className="animate-in fade-in duration-300">
                <GBOTab user={{ id: empresaAtivaId ?? "" }} empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "pcp" && (
              <div className="animate-in fade-in duration-300">
                <PCPTab empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "maquinas" && (
              <div className="animate-in fade-in duration-300">
                <MaquinasTab user={{ id: empresaAtivaId ?? "" }} empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "manutencao" && (
              <div className="animate-in fade-in duration-300">
                <ManutencaoTab user={{ id: empresaAtivaId ?? "" }} empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "apontamento" && (
              <div className="animate-in fade-in duration-300">
                <ApontamentoTab empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "estoque" && (
              <div className="animate-in fade-in duration-300">
                <EstoqueTab empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "relatorios" && (
              <div className="animate-in fade-in duration-300">
                <RelatoriosTab empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "excecoes" && (
              <div className="animate-in fade-in duration-300">
                <ExcecoesTab empresaAtivaId={empresaAtivaId} />
              </div>
            )}

            {activeTab === "configuracoes" && (
              <div className="space-y-8 pb-12 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Configurações</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Preferências e personalização do sistema</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <div className="space-y-6">

                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground">Fábrica</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Configurações operacionais padrão</p>
                      </div>
                      <div className="p-6 space-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome</label>
                          <input
                            type="text"
                            value={empresaName}
                            disabled
                            className="w-full h-10 px-4 rounded-xl border border-border bg-muted text-muted-foreground text-sm outline-none cursor-not-allowed"
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
                        <button
                          onClick={handleSaveConf}
                          disabled={isSavingConf}
                          className="w-full h-11 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[11px] rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50 mt-2"
                        >
                          {isSavingConf ? "Gravando..." : "Salvar Configurações"}
                        </button>
                      </div>
                    </div>

                    {/* CÓDIGO DE ACESSO */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Código de Acesso</h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Chave de entrada nesta fábrica</p>
                        </div>
                      </div>
                      <div className="p-6 space-y-3">
                        <div className="bg-muted rounded-xl p-4 flex items-center justify-between gap-3">
                          <span className="text-xl font-black tracking-[0.25em] text-foreground">
                            {showCodigo ? (codigoAtual ?? "—") : "••••••"}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setShowCodigo(!showCodigo)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                              title={showCodigo ? "Ocultar" : "Mostrar"}
                            >
                              {showCodigo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            {codigoAtual && (
                              <button
                                onClick={() => copiarCodigo(codigoAtual, setCopiadoConf)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                title="Copiar código"
                              >
                                {copiadoConf ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Compartilhe apenas com pessoas autorizadas a acessar esta fábrica.
                        </p>
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground">Aparência</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Escolha como o sistema é exibido na sua tela</p>
                      </div>
                      <div className="p-6 space-y-3">
                        {mounted && (
                          <React.Fragment>
                            {[
                              { value: "light",  label: "Claro",  description: "Fundo branco, ideal para ambientes iluminados",                    icon: Sun     },
                              { value: "dark",   label: "Escuro", description: "Fundo escuro, reduz fadiga visual à noite",                        icon: Moon    },
                              { value: "system", label: "Sistema",description: "Segue automaticamente as configurações do seu dispositivo",        icon: Monitor },
                            ].map(({ value, label, description, icon: Icon }) => (
                              <button
                                key={value}
                                onClick={() => setTheme(value)}
                                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all text-left
                                  ${theme === value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"}`}
                              >
                                <div className={`h-9 w-9 flex items-center justify-center rounded-lg flex-shrink-0
                                  ${theme === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-bold ${theme === value ? "text-primary" : "text-foreground"}`}>{label}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
                                </div>
                                <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all
                                  ${theme === value ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                  {theme === value && <div className="h-full w-full rounded-full bg-primary-foreground scale-50" />}
                                </div>
                              </button>
                            ))}
                          </React.Fragment>
                        )}
                      </div>
                    </div>
                  </div>

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
                        <p className="text-sm text-foreground/80">Cadastre o produto, adicione as operações com seus tempos de ciclo e salve para sincronizar com o PCP.</p>
                      </div>
                      <div className="border-t border-border pt-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">PCP — Programação de Produção</p>
                        <p className="text-sm text-foreground/80">Utiliza lógica Heijunka para nivelar a carga de produção. Crie ordens, configure capacidades por turno e visualize o fluxo no quadro de nivelamento.</p>
                      </div>
                      <div className="border-t border-border pt-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Código de Acesso</p>
                        <p className="text-sm text-foreground/80">Seu código de 6 caracteres é a única chave de acesso à sua fábrica. Compartilhe apenas com quem deve ter acesso. Para consultá-lo, acesse o banco de dados ou entre em contato com o suporte.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      {/* MODAL: CÓDIGO RECÉM-CRIADO */}
      {codigoNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-card border border-border p-8 rounded-2xl shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Fábrica criada!</h2>
              <p className="text-xs text-muted-foreground">Este é o código de acesso da sua fábrica. Anote agora — ele não será exibido novamente desta forma.</p>
            </div>

            <div className="space-y-3">
              <div className="bg-muted rounded-xl p-4 flex items-center justify-between gap-3">
                <span className="text-2xl font-black tracking-[0.3em] text-foreground">{codigoNovo}</span>
                <button
                  onClick={() => copiarCodigo(codigoNovo, setCopiado)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
                  title="Copiar código"
                >
                  {copiado ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Compartilhe só com quem deve acessar esta fábrica.
              </p>
            </div>

            <button
              onClick={() => setCodigoNovo(null)}
              className="w-full h-11 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[11px] rounded-xl shadow-md hover:opacity-90 transition-all"
            >
              Já anotei, entrar no sistema
            </button>
          </div>
        </div>
      )}

    </React.Fragment>
  )
}

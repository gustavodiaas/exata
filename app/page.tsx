"use client"

import React, { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"
import { GBOTab } from "@/components/gbo-tab"
import { PCPTab } from "@/components/pcp-tab"
import { ApontamentoTab } from "@/components/apontamento-tab"
import { DashboardTab } from "@/components/dashboard-tab"
import { MaquinasTab } from "@/components/maquinas-tab"
import { ManutencaoTab } from "@/components/manutencao-tab"
import { MasterTab } from "@/components/master-tab"
import { EquipeTab } from "@/components/equipe-tab"
import {
  Settings, Sun, Moon, Monitor, BookText, LogOut, ClipboardCheck, LayoutDashboard, User, BarChart2, CalendarClock, Menu, X, PanelLeftClose, Users, PanelLeftOpen, Factory, Wrench, ShieldAlert
} from "lucide-react"

type TabId = "dashboard" | "gbo" | "pcp" | "apontamento" | "maquinas" | "manutencao" | "configuracoes" | "master"

const NAV_ITEMS: { id: TabId; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", sublabel: "Visão geral da fábrica", icon: LayoutDashboard },
  { id: "gbo", label: "Produto/Roteiro", sublabel: "Gerenciamento Diário", icon: BarChart2 },
  { id: "pcp", label: "PCP", sublabel: "Programação de Produção", icon: CalendarClock },
  { id: "maquinas", label: "Máquinas", sublabel: "Postos de Trabalho", icon: Factory },
  { id: "manutencao", label: "Manutenção", sublabel: "Gestão de Ativos", icon: Wrench },
  { id: "apontamento", label: "Apontamento", sublabel: "Registro de Produção", icon: ClipboardCheck },
]

const NAV_BOTTOM: { id: TabId; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: "configuracoes", label: "Configurações", sublabel: "Preferências do sistema", icon: Settings },
]

export default function ExataApp() {
  const [user, setUser] = useState<any>(null)
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  
  const [empresaName, setEmpresaName] = useState("")
  const [defaultTime, setDefaultTime] = useState("")
  const [defaultTimeUnit, setDefaultTimeUnit] = useState<"hours" | "minutes" | "seconds">("hours")
  const [newPassword, setNewPassword] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)

  const [activeTab, setActiveTab] = useState<TabId>("gbo")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const loadUserProfile = async (userId: string, userEmail: string) => {
    try {
      const { data: perfil } = await supabase.from("perfis").select("empresa, tempo_padrao, unidade_tempo").eq("id", userId).single()
      if (perfil) {
        setEmpresaName(perfil.empresa || "")
        setDefaultTime(perfil.tempo_padrao ? perfil.tempo_padrao.toString() : "")
        setDefaultTimeUnit(perfil.unidade_tempo || "hours")
        
        if (!perfil.empresa || perfil.empresa.trim() === "") {
            setShowSetupModal(true)
        }
      }

      const { data: acesso } = await supabase.from("controle_acesso").select("nivel").eq("user_id", userId).single()
      if (acesso) {
        setUserRole(acesso.nivel)
      } else if (userEmail === "gustavodiaass@yahoo.com") {
        setUserRole("master")
      }
const { data: perms } = await supabase.from("permissoes").select("aba_id").eq("user_id", userId);
setUserPermissions(perms?.map(p => p.aba_id) || []);
    } catch (e) {
      console.error("Erro ao carregar perfil ou nível de acesso")
    }
const canAccess = (id: TabId) => {
  if (userRole === "master" || userRole === "adm") return true
  return userPermissions.includes(id)
}
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadUserProfile(session.user.id, session.user.email || "")
      } else {
        setUser(null)
        setUserRole(null)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadUserProfile(session.user.id, session.user.email || "")
      } else {
        setUser(null)
        setUserRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setMounted(true)
    const savedTab = localStorage.getItem("exata_aba_ativa") as TabId
    if (savedTab && ["dashboard", "gbo", "pcp", "apontamento", "maquinas", "manutencao", "configuracoes", "master"].includes(savedTab)) {
      setActiveTab(savedTab)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setIsLoadingAuth(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoginError("Credenciais inválidas ou acesso não autorizado.")
      setIsLoadingAuth(false)
      return
    }

    const { data: perfil } = await supabase.from("perfis").select("status").eq("id", data.user?.id).single()
    if (perfil && perfil.status === "inativo") {
      setLoginError("Sua assinatura está suspensa. Entre em contato com o administrador.")
      await supabase.auth.signOut()
      setIsLoadingAuth(false)
      return
    }

    setUser(data.user)
    setIsLoadingAuth(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
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
            <button type="submit" disabled={isLoadingAuth} className="w-full h-12 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded-xl shadow-md hover:opacity-90 transition-all">
              {isLoadingAuth ? "Validando Acesso..." : "Entrar no Sistema"}
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
        
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      ` }} />

      <div className="h-screen overflow-hidden bg-background flex print:block">
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
            {{NAV_ITEMS.filter(item => canAccess(item.id)).map((item)((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => { setActiveTab(item.id); localStorage.setItem("exata_aba_ativa", item.id) }} title={collapsed ? item.sublabel : undefined}
                  className={`w-full flex items-center rounded-xl transition-all text-left ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"} ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.sublabel}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="px-2 py-3 border-t border-border space-y-1">
            {userRole === "master" && (
              <button onClick={() => { setActiveTab("master"); localStorage.setItem("exata_aba_ativa", "master") }} title={collapsed ? "Painel Master" : undefined}
                className={`w-full flex items-center rounded-xl transition-all text-left ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"} ${activeTab === "master" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <ShieldAlert className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold leading-tight">Painel Master</span>
                    <span className={`text-[10px] leading-tight truncate ${activeTab === "master" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Gestão de Clientes</span>
                  </div>
                )}
              </button>
            )}
            
            {NAV_BOTTOM.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => { setActiveTab(item.id); localStorage.setItem("exata_aba_ativa", item.id) }} title={collapsed ? item.sublabel : undefined}
                  className={`w-full flex items-center rounded-xl transition-all text-left ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"} ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className={`text-[10px] leading-tight truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.sublabel}</span>
                    </div>
                  )}
                </button>
              )
            })}
            <button onClick={handleLogout} className={`w-full flex items-center rounded-xl text-destructive hover:bg-destructive/10 transition-all ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-3"}`} title={collapsed ? "Sair do sistema" : undefined}>
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-xs font-bold leading-tight">Sair do Sistema</span>}
            </button>
            {!collapsed && <p className="text-[9px] text-muted-foreground/50 font-medium text-center pt-2 pb-1">Construído para quem valoriza a precisão. Exata © 2026</p>}
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
                <button key={item.id} onClick={() => { setActiveTab(item.id); localStorage.setItem("exata_aba_ativa", item.id); setMobileOpen(false) }}
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
            {userRole === "master" && (
              <button onClick={() => { setActiveTab("master"); localStorage.setItem("exata_aba_ativa", "master"); setMobileOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeTab === "master" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold leading-tight">Painel Master</span>
                  <span className={`text-[10px] leading-tight truncate ${activeTab === "master" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Gestão de Clientes</span>
                </div>
              </button>
            )}

            {NAV_BOTTOM.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => { setActiveTab(item.id); localStorage.setItem("exata_aba_ativa", item.id); setMobileOpen(false) }}
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
            
            {activeTab === "master" && userRole === "master" && (
              <div className="animate-in fade-in duration-300">
                <MasterTab />
              </div>
            )}
            {activeTab === "equipe" && (
  <div className="animate-in fade-in duration-300">
    <EquipeTab user={user} />
  </div>
)}

            {activeTab === "gbo" && (
              <div className="animate-in fade-in duration-300">
                <GBOTab user={user} />
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

            {activeTab === "maquinas" && (
              <div className="animate-in fade-in duration-300">
                <MaquinasTab user={user} />
              </div>
            )}
            
            {activeTab === "manutencao" && (
              <div className="animate-in fade-in duration-300">
                <ManutencaoTab user={user} />
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
                  <div className="space-y-6">
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
                          <input type="text" placeholder="Nome do seu negócio ou responsável" value={empresaName} onChange={(e) => setEmpresaName(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Tempo Operacional Padrão</label>
                          <div className="flex gap-2">
                            <input type="number" placeholder="Ex: 8" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} className="flex-1 h-10 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                            <select value={defaultTimeUnit} onChange={(e: any) => setDefaultTimeUnit(e.target.value)} className="w-32 h-10 px-3 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer">
                              <option value="hours">Horas</option>
                              <option value="minutes">Minutos</option>
                              <option value="seconds">Segundos</option>
                            </select>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nova Senha de Acesso</label>
                          <input type="password" placeholder="Deixe em branco para manter a atual (Mín. 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
                        </div>
                        <button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full h-11 flex items-center justify-center bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[11px] rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50 mt-2">
                          {isSavingProfile ? "Gravando Dados..." : "Salvar Configurações da Conta"}
                        </button>
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
                              { value: "light", label: "Claro", description: "Fundo branco, ideal para ambientes iluminados", icon: Sun },
                              { value: "dark", label: "Escuro", description: "Fundo escuro, reduz fadiga visual à noite", icon: Moon },
                              { value: "system", label: "Sistema", description: "Segue automaticamente as configurações do seu dispositivo", icon: Monitor },
                            ].map(({ value, label, description, icon: Icon }) => (
                              <button key={value} onClick={() => setTheme(value)} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all text-left ${theme === value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"}`}>
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

      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-card border border-border p-8 rounded-2xl shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Bem-vindo à Exata</h2>
              <p className="text-xs text-muted-foreground">Complete seu perfil para começar.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome da Empresa</label>
                <input 
                    type="text" 
                    value={empresaName} 
                    onChange={(e) => setEmpresaName(e.target.value)} 
                    className="w-full h-10 px-4 rounded-xl border border-border bg-input text-sm text-foreground outline-none focus:ring-2 focus:ring-primary transition-all" 
                    placeholder="Ex: Indústria Ltda" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Definir Nova Senha</label>
                <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="w-full h-10 px-4 rounded-xl border border-border bg-input text-sm text-foreground outline-none focus:ring-2 focus:ring-primary transition-all" 
                    placeholder="••••••••" 
                />
              </div>
              <button 
                onClick={async () => { 
                    await handleSaveProfile(); 
                    if(empresaName.trim() !== "") {
                        setShowSetupModal(false);
                    }
                }} 
                className="w-full h-11 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md mt-2"
              >
                Salvar e Iniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  )
}

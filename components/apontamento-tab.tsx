"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { supabase } from "@/components/supabase"
import { useToast } from "@/hooks/use-toast"
import { NativeSelect } from "@/components/native-select"
import {
  Play, Pause, Square, Plus, Trash2, ClipboardList, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, Package, Factory, ChevronDown, X
} from "lucide-react"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface OrdemProducao {
  id: string
  numero_op: string
  produto_codigo: string
  produto_descricao?: string
  quantidade: number
  data_programacao: string
  status?: string
}

interface Operacao {
  id: string
  nome: string
  maquina_id?: string
  maquina_nome?: string
  maquina_codigo?: string
  ordem: number
}

interface Apontamento {
  id: string
  ordem_id: string
  operacao_id?: string
  operacao_nome?: string
  cronometro_total_segundos: number
  pecas_produzidas: number
  pecas_refugo: number
  pecas_retrabalho: number
  status: string
  encerramento?: string
  created_at: string
}

interface Pausa {
  id: string
  inicio: string
  fim?: string
  subgrupo_nome?: string
  grupo_nome?: string
}

interface Grupo {
  id: string
  nome: string
  subgrupos: { id: string; nome: string }[]
}

interface SessaoAtiva {
  apontamentoId: string
  ordemId: string
  operacaoId: string
  operacaoNome: string
  maquinaNome: string
  inicioTimestamp: number
  segundosAcumulados: number
  pausaInicioTimestamp?: number
  pausaId?: string
  cicloPlanejadoSeg?: number
}

const SESSAO_KEY = "exata_apontamento_sessao_"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function badgeStatus(pct: number) {
  if (pct >= 100) return { label: "Concluída", classes: "bg-green-500/10 text-green-600 border border-green-500/20" }
  if (pct >= 50) return { label: "Em andamento", classes: "bg-primary/10 text-primary border border-primary/20" }
  return { label: "Iniciada", classes: "bg-amber-500/10 text-amber-600 border border-amber-500/20" }
}

// ─── Modal de Pausa ───────────────────────────────────────────────────────────

function ModalPausa({ grupos, onConfirm, onCancel }: {
  grupos: Grupo[]
  onConfirm: (subgrupoId: string) => void
  onCancel: () => void
}) {
  const [grupoId, setGrupoId] = useState("")
  const [subgrupoId, setSubgrupoId] = useState("")
  const grupo = grupos.find(g => g.id === grupoId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Motivo da Parada</h3>
          <button onClick={onCancel} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Grupo</label>
            <NativeSelect value={grupoId} onChange={e => { setGrupoId(e.target.value); setSubgrupoId("") }}>
              <option value="">Selecione o grupo</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </NativeSelect>
          </div>

          {grupo && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Motivo</label>
              <NativeSelect value={subgrupoId} onChange={e => setSubgrupoId(e.target.value)}>
                <option value="">Selecione o motivo</option>
                {grupo.subgrupos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </NativeSelect>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => subgrupoId && onConfirm(subgrupoId)}
            disabled={!subgrupoId}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
          >
            Pausar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de Finalizar ────────────────────────────────────────────────────────

function ModalFinalizar({ onConfirm, onCancel }: {
  onConfirm: (dados: { produzidas: number; refugo: number; retrabalho: number; encerramento: "continuar" | "encerrar" | "encerrar_parcial" }) => void
  onCancel: () => void
}) {
  const [produzidas, setProduzidas] = useState("")
  const [refugo, setRefugo] = useState("")
  const [retrabalho, setRetrabalho] = useState("")
  const [encerramento, setEncerramento] = useState<"continuar" | "encerrar" | "encerrar_parcial">("continuar")

  const handleConfirm = () => {
    if (!produzidas || parseInt(produzidas) <= 0) return
    onConfirm({
      produzidas: parseInt(produzidas),
      refugo: parseInt(refugo) || 0,
      retrabalho: parseInt(retrabalho) || 0,
      encerramento,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Registrar Produção</h3>
          <button onClick={onCancel} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Peças Produzidas *</label>
            <input
              type="number" min="1" placeholder="Ex: 120"
              value={produzidas} onChange={e => setProduzidas(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Refugo</label>
              <input
                type="number" min="0" placeholder="0"
                value={refugo} onChange={e => setRefugo(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Retrabalho</label>
              <input
                type="number" min="0" placeholder="0"
                value={retrabalho} onChange={e => setRetrabalho(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">O que fazer com a OP?</label>
            <div className="space-y-2">
              {[
                { value: "continuar", label: "Continuar produzindo", desc: "Salva este apontamento e segue a OP aberta" },
                { value: "encerrar", label: "Encerrar OP", desc: "Marca a OP como concluída" },
                { value: "encerrar_parcial", label: "Encerrar parcialmente", desc: "Encerra com quantidade menor que o planejado" },
              ].map(op => (
                <button
                  key={op.value}
                  onClick={() => setEncerramento(op.value as any)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all
                    ${encerramento === op.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all
                    ${encerramento === op.value ? "border-primary bg-primary" : "border-muted-foreground/30"}`} />
                  <div>
                    <p className={`text-sm font-bold ${encerramento === op.value ? "text-primary" : "text-foreground"}`}>{op.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{op.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!produzidas || parseInt(produzidas) <= 0}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ApontamentoTab({ empresaAtivaId }: { empresaAtivaId?: string | null }) {
  const { toast } = useToast()

  const [ordens, setOrdens] = useState<OrdemProducao[]>([])
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)

  // Seleção de OP e operação
  const [ordemSelecionadaId, setOrdemSelecionadaId] = useState("")
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [operacaoSelecionadaId, setOperacaoSelecionadaId] = useState("")
  const [loadingOps, setLoadingOps] = useState(false)

  // Sessão ativa (cronômetro)
  const [sessao, setSessao] = useState<SessaoAtiva | null>(null)
  const [segundosDisplay, setSegundosDisplay] = useState(0)
  const [emPausa, setEmPausa] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Modais
  const [showModalPausa, setShowModalPausa] = useState(false)
  const [showModalFinalizar, setShowModalFinalizar] = useState(false)
  const [dadosFinalizar, setDadosFinalizar] = useState<{ produzidas: number; refugo: number; retrabalho: number; encerramento: "continuar" | "encerrar" | "encerrar_parcial" } | null>(null)
  const [showAvisoEstoque, setShowAvisoEstoque] = useState(false)
  const [avisoItens, setAvisoItens] = useState<{ codigo: string; descricao: string; disponivel: number; necessario: number; unidade: string }[]>([])

  // Painel
  const [opExpandida, setOpExpandida] = useState<string | null>(null)

  // ─── Carga inicial ─────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data: opsData }, { data: apData }, { data: gData }, { data: sData }] = await Promise.all([
        supabase.from("ordens_producao")
          .select("id, numero_op, produto_codigo, quantidade, data_programacao, status")
          .eq("empresa_id", empresaAtivaId!)
          .order("data_programacao", { ascending: true }),
        supabase.from("apontamentos")
          .select("id, ordem_id, operacao_id, operacao_nome, cronometro_total_segundos, pecas_produzidas, pecas_refugo, pecas_retrabalho, status, encerramento, created_at")
          .eq("empresa_id", empresaAtivaId!)
          .order("created_at", { ascending: false }),
        supabase.from("excecao_grupos").select("id, nome").eq("empresa_id", empresaAtivaId!).order("nome"),
        supabase.from("excecao_subgrupos").select("id, grupo_id, nome").eq("empresa_id", empresaAtivaId!).order("nome"),
      ])

      setOrdens((opsData || []) as OrdemProducao[])
      setApontamentos((apData || []) as Apontamento[])

      const gruposFormatados: Grupo[] = (gData || []).map((g: any) => ({
        id: g.id,
        nome: g.nome,
        subgrupos: (sData || []).filter((s: any) => s.grupo_id === g.id),
      }))
      setGrupos(gruposFormatados)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (empresaAtivaId) {
      loadData()
      // Restaura sessão do localStorage
      const raw = localStorage.getItem(SESSAO_KEY + empresaAtivaId)
      if (raw) {
        try {
          const s: SessaoAtiva = JSON.parse(raw)
          setSessao(s)
          setEmPausa(!!s.pausaInicioTimestamp)
        } catch { }
      }
    }
  }, [empresaAtivaId])

  // Cronômetro
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!sessao || emPausa) return

    const tick = () => {
      const agora = Date.now()
      const decorrido = Math.floor((agora - sessao.inicioTimestamp) / 1000)
      setSegundosDisplay(sessao.segundosAcumulados + decorrido)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [sessao, emPausa])

  const salvarSessao = useCallback((s: SessaoAtiva | null) => {
    if (!empresaAtivaId) return
    if (s) localStorage.setItem(SESSAO_KEY + empresaAtivaId, JSON.stringify(s))
    else localStorage.removeItem(SESSAO_KEY + empresaAtivaId)
    setSessao(s)
  }, [empresaAtivaId])

  // ─── Carrega operações ao selecionar OP ────────────────────────────────────

  useEffect(() => {
    if (!ordemSelecionadaId) { setOperacoes([]); setOperacaoSelecionadaId(""); return }
    const ordem = ordens.find(o => o.id === ordemSelecionadaId)
    if (!ordem) return
    setLoadingOps(true)

    supabase
      .from("produtos")
      .select("id")
      .eq("codigo", ordem.produto_codigo)
      .eq("empresa_id", empresaAtivaId!)
      .single()
      .then(({ data: prod }) => {
        if (!prod) { setOperacoes([]); setLoadingOps(false); return }
        supabase
          .from("operacoes")
          .select("id, nome, maquina_id, ordem, maquinas(nome, codigo)")
          .eq("produto_id", prod.id)
          .order("ordem")
          .then(({ data: ops }) => {
            const formatted: Operacao[] = (ops || []).map((o: any) => ({
              id: o.id,
              nome: o.nome,
              maquina_id: o.maquina_id,
              maquina_nome: o.maquinas?.nome,
              maquina_codigo: o.maquinas?.codigo,
              ordem: o.ordem,
            }))
            setOperacoes(formatted)
            setLoadingOps(false)
          })
      })
  }, [ordemSelecionadaId])

  // ─── Iniciar ───────────────────────────────────────────────────────────────

  const handleIniciar = async () => {
    if (!ordemSelecionadaId || !operacaoSelecionadaId) {
      toast({ title: "Selecione a OP e a operação", variant: "destructive" })
      return
    }
    const op = operacoes.find(o => o.id === operacaoSelecionadaId)
    if (!op) return

    // Busca tempo planejado da operação no banco para ter unidade correta
    const { data: opDb } = await supabase
      .from("operacoes")
      .select("tempo, unidade")
      .eq("id", operacaoSelecionadaId)
      .single()

    const cicloPlanejadoSeg = opDb
      ? (opDb.unidade === "minutes" ? opDb.tempo * 60 : opDb.tempo)
      : undefined

    const { data, error } = await supabase
      .from("apontamentos")
      .insert({
        empresa_id: empresaAtivaId,
        ordem_id: ordemSelecionadaId,
        operacao_id: operacaoSelecionadaId,
        operacao_nome: op.nome,
        maquina_id: op.maquina_id || null,
        cronometro_inicio: new Date().toISOString(),
        cronometro_total_segundos: 0,
        pecas_produzidas: 0,
        pecas_refugo: 0,
        pecas_retrabalho: 0,
        status: "em_andamento",
        data_apontamento: new Date().toISOString().split("T")[0],
        hora_inicio: new Date().toTimeString().slice(0, 5),
        hora_fim: new Date().toTimeString().slice(0, 5),
      })
      .select()
      .single()

    if (error) { toast({ title: "Erro ao iniciar", description: error.message, variant: "destructive" }); return }

    const novaSessao: SessaoAtiva = {
      apontamentoId: data.id,
      ordemId: ordemSelecionadaId,
      operacaoId: operacaoSelecionadaId,
      operacaoNome: op.nome,
      maquinaNome: op.maquina_nome ? `${op.maquina_codigo} - ${op.maquina_nome}` : "Manual",
      inicioTimestamp: Date.now(),
      segundosAcumulados: 0,
      cicloPlanejadoSeg,
    }
    salvarSessao(novaSessao)
    setEmPausa(false)
    setSegundosDisplay(0)
    toast({ title: "▶ Apontamento iniciado", description: op.nome })
  }

  // ─── Pausar ────────────────────────────────────────────────────────────────

  const handleConfirmarPausa = async (subgrupoId: string) => {
    if (!sessao) return
    setShowModalPausa(false)

    const agora = Date.now()
    const decorrido = Math.floor((agora - sessao.inicioTimestamp) / 1000)
    const totalAtual = sessao.segundosAcumulados + decorrido

    const { data: pausa, error } = await supabase
      .from("apontamento_pausas")
      .insert({
        empresa_id: empresaAtivaId,
        apontamento_id: sessao.apontamentoId,
        subgrupo_id: subgrupoId,
        inicio: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) { toast({ title: "Erro ao registrar pausa", variant: "destructive" }); return }

    const sessaoAtualizada: SessaoAtiva = {
      ...sessao,
      segundosAcumulados: totalAtual,
      inicioTimestamp: agora,
      pausaInicioTimestamp: agora,
      pausaId: pausa.id,
    }
    salvarSessao(sessaoAtualizada)
    setEmPausa(true)
    toast({ title: "⏸ Em pausa" })
  }

  // ─── Retomar ───────────────────────────────────────────────────────────────

  const handleRetomar = async () => {
    if (!sessao?.pausaId) return

    await supabase
      .from("apontamento_pausas")
      .update({ fim: new Date().toISOString() })
      .eq("id", sessao.pausaId)

    const sessaoAtualizada: SessaoAtiva = {
      ...sessao,
      inicioTimestamp: Date.now(),
      pausaInicioTimestamp: undefined,
      pausaId: undefined,
    }
    salvarSessao(sessaoAtualizada)
    setEmPausa(false)
    toast({ title: "▶ Produção retomada" })
  }

  // ─── Verificação de estoque antes de encerrar ──────────────────────────────

  const verificarEstoqueEFinalizar = async (dados: {
    produzidas: number; refugo: number; retrabalho: number
    encerramento: "continuar" | "encerrar" | "encerrar_parcial"
  }) => {
    setShowModalFinalizar(false)

    // Se não vai encerrar, não precisa verificar
    if (dados.encerramento === "continuar") {
      handleConfirmarFinalizar(dados)
      return
    }

    const ordem = ordens.find(o => o.id === sessao?.ordemId)
    if (!ordem) { handleConfirmarFinalizar(dados); return }

    const pecasBoas = dados.produzidas - dados.refugo

    // Busca BOM
    const { data: bomData } = await supabase
      .from("bom_itens")
      .select("insumo_id, quantidade, unidade_medida, insumos(codigo, descricao)")
      .eq("empresa_id", empresaAtivaId!)
      .eq("produto_codigo", ordem.produto_codigo)

    if (!bomData || bomData.length === 0) {
      // Sem BOM, avisa e deixa encerrar
      toast({
        title: "⚠ BOM não cadastrada",
        description: `O produto ${ordem.produto_codigo} não tem lista de materiais. O estoque não será atualizado automaticamente.`,
        variant: "destructive",
      })
      handleConfirmarFinalizar(dados)
      return
    }

    // Verifica saldo de cada insumo
    const insuficientes: typeof avisoItens = []

    for (const bom of bomData as any[]) {
      const necessario = bom.quantidade * pecasBoas
      const { data: saldo } = await supabase
        .from("saldo_estoque")
        .select("saldo_atual")
        .eq("insumo_id", bom.insumo_id)
        .eq("empresa_id", empresaAtivaId!)
        .single()

      const disponivel = saldo?.saldo_atual ?? 0
      if (disponivel < necessario) {
        insuficientes.push({
          codigo: bom.insumos?.codigo ?? "",
          descricao: bom.insumos?.descricao ?? "",
          disponivel,
          necessario,
          unidade: bom.unidade_medida,
        })
      }
    }

    if (insuficientes.length > 0) {
      setAvisoItens(insuficientes)
      setDadosFinalizar(dados)
      setShowAvisoEstoque(true)
    } else {
      handleConfirmarFinalizar(dados)
    }
  }

  const handleConfirmarFinalizar = async (dados: {
    produzidas: number; refugo: number; retrabalho: number
    encerramento: "continuar" | "encerrar" | "encerrar_parcial"
  }) => {
    if (!sessao) return
    setShowModalFinalizar(false)

    const agora = Date.now()
    const decorrido = emPausa ? 0 : Math.floor((agora - sessao.inicioTimestamp) / 1000)
    const totalSegundos = sessao.segundosAcumulados + decorrido

    // Fecha pausa aberta se houver
    if (sessao.pausaId) {
      await supabase.from("apontamento_pausas").update({ fim: new Date().toISOString() }).eq("id", sessao.pausaId)
    }

    // Salva o apontamento
    const { error } = await supabase
      .from("apontamentos")
      .update({
        cronometro_total_segundos: totalSegundos,
        pecas_produzidas: dados.produzidas,
        pecas_refugo: dados.refugo,
        pecas_retrabalho: dados.retrabalho,
        status: dados.encerramento === "continuar" ? "aberto" : "fechado",
        encerramento: dados.encerramento,
        hora_fim: new Date().toTimeString().slice(0, 5),
      })
      .eq("id", sessao.apontamentoId)

    if (error) { toast({ title: "Erro ao finalizar", description: error.message, variant: "destructive" }); return }

    // ── Integração com estoque ao encerrar ──────────────────────────────────
    if (dados.encerramento !== "continuar") {
      const ordem = ordens.find(o => o.id === sessao.ordemId)
      if (ordem) {
        const pecasBoas = dados.produzidas - dados.refugo

        // 1. Busca a BOM do produto
        const { data: bomData } = await supabase
          .from("bom_itens")
          .select("insumo_id, quantidade, unidade_medida, insumos(codigo, descricao, unidade_medida)")
          .eq("empresa_id", empresaAtivaId!)
          .eq("produto_codigo", ordem.produto_codigo)

        if (bomData && bomData.length > 0 && pecasBoas > 0) {
          // 2. Para cada insumo da BOM, debita o consumo proporcional
          for (const bom of bomData as any[]) {
            const qtdConsumida = bom.quantidade * pecasBoas

            // Busca saldo atual
            const { data: saldo } = await supabase
              .from("saldo_estoque")
              .select("saldo_atual, custo_medio")
              .eq("insumo_id", bom.insumo_id)
              .eq("empresa_id", empresaAtivaId!)
              .single()

            const saldoAnterior = saldo?.saldo_atual ?? 0
            const custoMedio = saldo?.custo_medio ?? 0
            const saldoPosterior = Math.max(0, saldoAnterior - qtdConsumida)

            // Atualiza saldo
            await supabase.from("saldo_estoque").upsert({
              empresa_id: empresaAtivaId,
              insumo_id: bom.insumo_id,
              saldo_atual: saldoPosterior,
              custo_medio: custoMedio,
              updated_at: new Date().toISOString(),
            }, { onConflict: "empresa_id,insumo_id" })

            // Registra movimentação de consumo
            await supabase.from("movimentacoes_estoque").insert({
              empresa_id: empresaAtivaId,
              insumo_id: bom.insumo_id,
              tipo: "saida_producao",
              quantidade: qtdConsumida,
              quantidade_anterior: saldoAnterior,
              quantidade_posterior: saldoPosterior,
              custo_unitario: custoMedio,
              valor_total: qtdConsumida * custoMedio,
              origem: "op_automatico",
              referencia_id: sessao.ordemId,
              observacao: `OP ${ordem.numero_op} — ${pecasBoas} peças boas`,
            })

            // Avisa se foi a negativo
            if (saldoAnterior < qtdConsumida) {
              toast({
                title: `⚠ Estoque insuficiente: ${bom.insumos?.codigo}`,
                description: `Consumo: ${qtdConsumida} ${bom.unidade_medida} — Disponível: ${saldoAnterior.toFixed(3)}. Saldo foi a negativo.`,
                variant: "destructive",
              })
            }
          }

          // 3. Calcula custo total da BOM para o produto acabado
          const custoBomTotal = (bomData as any[]).reduce((acc, bom) => {
            const saldoItem = acc // aproximação: usa custo médio atual
            return acc
          }, 0)

          // Busca custo médio real de cada insumo para calcular custo do PA
          let custoPA = 0
          for (const bom of bomData as any[]) {
            const { data: saldo } = await supabase
              .from("saldo_estoque")
              .select("custo_medio")
              .eq("insumo_id", bom.insumo_id)
              .eq("empresa_id", empresaAtivaId!)
              .single()
            custoPA += (saldo?.custo_medio ?? 0) * bom.quantidade
          }

          // 4. Entrada do produto acabado no estoque
          const { data: produtoPA } = await supabase
            .from("insumos")
            .select("id, unidade_medida, codigo")
            .eq("empresa_id", empresaAtivaId!)
            .eq("codigo", ordem.produto_codigo)
            .single()

          if (produtoPA) {
            const { data: saldoPA } = await supabase
              .from("saldo_estoque")
              .select("saldo_atual, custo_medio")
              .eq("insumo_id", produtoPA.id)
              .eq("empresa_id", empresaAtivaId!)
              .single()

            const saldoAnteriorPA = saldoPA?.saldo_atual ?? 0
            const custoMedioAnteriorPA = saldoPA?.custo_medio ?? 0
            const saldoPosteriorPA = saldoAnteriorPA + pecasBoas
            const novoCustoMedioPA = saldoAnteriorPA === 0
              ? custoPA
              : ((saldoAnteriorPA * custoMedioAnteriorPA) + (pecasBoas * custoPA)) / saldoPosteriorPA

            await supabase.from("saldo_estoque").upsert({
              empresa_id: empresaAtivaId,
              insumo_id: produtoPA.id,
              saldo_atual: saldoPosteriorPA,
              custo_medio: novoCustoMedioPA,
              updated_at: new Date().toISOString(),
            }, { onConflict: "empresa_id,insumo_id" })

            await supabase.from("movimentacoes_estoque").insert({
              empresa_id: empresaAtivaId,
              insumo_id: produtoPA.id,
              tipo: "entrada_producao",
              quantidade: pecasBoas,
              quantidade_anterior: saldoAnteriorPA,
              quantidade_posterior: saldoPosteriorPA,
              custo_unitario: custoPA,
              valor_total: pecasBoas * custoPA,
              origem: "op_automatico",
              referencia_id: sessao.ordemId,
              observacao: `OP ${ordem.numero_op} — produção encerrada`,
            })
          }
        }

        // 5. Refugo — saída separada do produto acabado se houver
        if (dados.refugo > 0) {
          const { data: produtoPA } = await supabase
            .from("insumos")
            .select("id, unidade_medida")
            .eq("empresa_id", empresaAtivaId!)
            .eq("codigo", ordem.produto_codigo)
            .single()

          if (produtoPA) {
            const { data: saldoPA } = await supabase
              .from("saldo_estoque")
              .select("saldo_atual, custo_medio")
              .eq("insumo_id", produtoPA.id)
              .eq("empresa_id", empresaAtivaId!)
              .single()

            const saldoAnterior = saldoPA?.saldo_atual ?? 0
            const custoMedio = saldoPA?.custo_medio ?? 0
            const saldoPosterior = Math.max(0, saldoAnterior - dados.refugo)

            await supabase.from("saldo_estoque").upsert({
              empresa_id: empresaAtivaId,
              insumo_id: produtoPA.id,
              saldo_atual: saldoPosterior,
              custo_medio: custoMedio,
              updated_at: new Date().toISOString(),
            }, { onConflict: "empresa_id,insumo_id" })

            await supabase.from("movimentacoes_estoque").insert({
              empresa_id: empresaAtivaId,
              insumo_id: produtoPA.id,
              tipo: "refugo",
              quantidade: dados.refugo,
              quantidade_anterior: saldoAnterior,
              quantidade_posterior: saldoPosterior,
              custo_unitario: custoMedio,
              valor_total: dados.refugo * custoMedio,
              origem: "op_automatico",
              referencia_id: sessao.ordemId,
              observacao: `OP ${ordem.numero_op} — peças refugadas`,
            })
          }
        }

        // 6. Encerra a OP
        await supabase.from("ordens_producao").update({ status: "encerrada" }).eq("id", sessao.ordemId)
      }
    }

    salvarSessao(null)
    setEmPausa(false)
    setSegundosDisplay(0)
    await loadData()

    const labels = { continuar: "Apontamento salvo", encerrar: "OP encerrada e estoque atualizado", encerrar_parcial: "OP encerrada parcialmente e estoque atualizado" }
    toast({ title: `✅ ${labels[dados.encerramento]}` })
  }

  // ─── Resumos por OP ────────────────────────────────────────────────────────

  const resumos = useMemo(() => {
    return ordens.map(op => {
      const aps = apontamentos.filter(a => a.ordem_id === op.id)
      const totalProduzidas = aps.reduce((s, a) => s + (a.pecas_produzidas || 0), 0)
      const totalRefugo = aps.reduce((s, a) => s + (a.pecas_refugo || 0), 0)
      const totalRetrabalho = aps.reduce((s, a) => s + (a.pecas_retrabalho || 0), 0)
      const totalSegundos = aps.reduce((s, a) => s + (a.cronometro_total_segundos || 0), 0)
      const pct = op.quantidade > 0 ? Math.min(100, (totalProduzidas / op.quantidade) * 100) : 0
      const fechada = op.status === "encerrada" || totalProduzidas >= op.quantidade
      return { op, aps, totalProduzidas, totalRefugo, totalRetrabalho, totalSegundos, pct, fechada }
    })
  }, [ordens, apontamentos])

  const kpis = useMemo(() => {
    const totalOPs = ordens.length
    const opsFechadas = resumos.filter(r => r.fechada).length
    const totalProduzidas = apontamentos.reduce((s, a) => s + (a.pecas_produzidas || 0), 0)
    const totalRefugo = apontamentos.reduce((s, a) => s + (a.pecas_refugo || 0), 0)
    const pctRefugo = totalProduzidas + totalRefugo > 0
      ? ((totalRefugo / (totalProduzidas + totalRefugo)) * 100).toFixed(1) : "0.0"
    return { totalOPs, opsFechadas, totalProduzidas, totalRefugo, pctRefugo }
  }, [resumos, apontamentos, ordens])

  const ordemAtual = ordens.find(o => o.id === (sessao?.ordemId || ordemSelecionadaId))

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-widest animate-pulse">
        Carregando apontamentos...
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">

      {/* Modais */}
      {showModalPausa && (
        <ModalPausa
          grupos={grupos}
          onConfirm={handleConfirmarPausa}
          onCancel={() => setShowModalPausa(false)}
        />
      )}
      {showModalFinalizar && (
        <ModalFinalizar
          onConfirm={verificarEstoqueEFinalizar}
          onCancel={() => setShowModalFinalizar(false)}
        />
      )}

      {/* Modal aviso estoque insuficiente */}
      {showAvisoEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Estoque insuficiente</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Os itens abaixo não têm saldo suficiente para cobrir o consumo desta OP. O encerramento vai deixar o estoque negativo.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {avisoItens.map((item, i) => (
                <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-foreground">{item.codigo} — {item.descricao}</p>
                  <div className="flex gap-4 text-[11px]">
                    <span className="text-muted-foreground">Disponível: <strong className="text-foreground">{item.disponivel.toFixed(3)} {item.unidade}</strong></span>
                    <span className="text-muted-foreground">Necessário: <strong className="text-destructive">{item.necessario.toFixed(3)} {item.unidade}</strong></span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, (item.disponivel / item.necessario) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-xl px-4 py-3">
              Você pode encerrar mesmo assim. O sistema vai registrar o consumo e o saldo ficará negativo até a próxima entrada de material.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowAvisoEstoque(false); setDadosFinalizar(null) }}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowAvisoEstoque(false)
                  if (dadosFinalizar) handleConfirmarFinalizar(dadosFinalizar)
                }}
                className="flex-1 h-11 rounded-xl bg-amber-500 text-white text-sm font-bold hover:opacity-90 transition-all"
              >
                Encerrar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Painel de controle */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Apontamento</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Selecione a OP e a operação para iniciar</p>
          </div>

          <div className="p-6 space-y-4">
            {!sessao ? (
              <>
                {/* Seleção de OP */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ordem de Produção</label>
                  <NativeSelect value={ordemSelecionadaId} onChange={e => { setOrdemSelecionadaId(e.target.value); setOperacaoSelecionadaId("") }}>
                    <option value="">Selecione a OP</option>
                    {ordens.filter(o => o.status !== "encerrada").map(op => (
                      <option key={op.id} value={op.id}>{op.numero_op} — {op.produto_codigo}</option>
                    ))}
                  </NativeSelect>
                </div>

                {/* Dados da OP */}
                {ordemAtual && (
                  <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produto</span>
                      <span className="font-bold text-foreground">{ordemAtual.produto_codigo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantidade</span>
                      <span className="font-bold text-foreground">{ordemAtual.quantidade} peças</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Programada</span>
                      <span className="font-bold text-foreground">{ordemAtual.data_programacao?.split("-").reverse().join("/")}</span>
                    </div>
                  </div>
                )}

                {/* Seleção de operação */}
                {ordemSelecionadaId && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Operação</label>
                    {loadingOps ? (
                      <div className="h-11 rounded-xl border border-border bg-muted animate-pulse" />
                    ) : operacoes.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">Nenhuma operação no roteiro deste produto.</p>
                    ) : (
                      <NativeSelect value={operacaoSelecionadaId} onChange={e => setOperacaoSelecionadaId(e.target.value)}>
                        <option value="">Selecione a operação</option>
                        {operacoes.map(op => (
                          <option key={op.id} value={op.id}>
                            {op.ordem}. {op.nome}{op.maquina_codigo ? ` — ${op.maquina_codigo}` : ""}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </div>
                )}

                <button
                  onClick={handleIniciar}
                  disabled={!ordemSelecionadaId || !operacaoSelecionadaId}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                >
                  <Play className="h-4 w-4" /> Iniciar
                </button>
              </>
            ) : (
              <>
                {/* Cronômetro ativo com semáforo */}
                {(() => {
                  const ciclo = sessao.cicloPlanejadoSeg
                  const pct = ciclo && ciclo > 0 && segundosDisplay > 0
                    ? (segundosDisplay / ciclo) * 100
                    : null
                  const semaforo = emPausa
                    ? { cor: "text-amber-500", bg: "bg-amber-500/10", borda: "border-amber-500/30", label: "Em pausa", barra: "bg-amber-500" }
                    : pct === null
                    ? { cor: "text-foreground", bg: "bg-muted/40", borda: "border-transparent", label: "Sem ciclo padrão", barra: "bg-primary" }
                    : pct <= 90
                    ? { cor: "text-green-600", bg: "bg-green-500/10", borda: "border-green-500/30", label: "Dentro do tempo", barra: "bg-green-500" }
                    : pct <= 110
                    ? { cor: "text-amber-500", bg: "bg-amber-500/10", borda: "border-amber-500/30", label: "No limite", barra: "bg-amber-500" }
                    : { cor: "text-destructive", bg: "bg-destructive/10", borda: "border-destructive/30", label: "Tempo estourado", barra: "bg-destructive" }

                  return (
                    <div className={`rounded-xl p-4 text-center space-y-2 border ${semaforo.bg} ${semaforo.borda} transition-all`}>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tempo decorrido</p>
                      <p className={`text-4xl font-black tabular-nums tracking-tight ${semaforo.cor}`}>
                        {formatarTempo(segundosDisplay)}
                      </p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${semaforo.cor}`}>
                        {semaforo.label}
                      </p>
                      {ciclo && ciclo > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${semaforo.barra}`}
                              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Ciclo padrão: {formatarTempo(ciclo)}
                            {pct !== null && ` — ${pct.toFixed(0)}%`}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="bg-muted/20 rounded-xl p-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OP</span>
                    <span className="font-bold text-foreground">{ordens.find(o => o.id === sessao.ordemId)?.numero_op}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operação</span>
                    <span className="font-bold text-foreground">{sessao.operacaoNome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Máquina</span>
                    <span className="font-bold text-foreground">{sessao.maquinaNome}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {emPausa ? (
                    <button
                      onClick={handleRetomar}
                      className="col-span-2 h-11 flex items-center justify-center gap-2 bg-green-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all"
                    >
                      <Play className="h-4 w-4" /> Retomar
                    </button>
                  ) : (
                    <button
                      onClick={() => grupos.length > 0 ? setShowModalPausa(true) : toast({ title: "Cadastre exceções primeiro", description: "Vá em Exceções e crie grupos de parada.", variant: "destructive" })}
                      className="h-11 flex items-center justify-center gap-2 bg-amber-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all"
                    >
                      <Pause className="h-4 w-4" /> Pausar
                    </button>
                  )}
                  {!emPausa && (
                    <button
                      onClick={() => setShowModalFinalizar(true)}
                      className="h-11 flex items-center justify-center gap-2 bg-card border border-border text-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-muted transition-all"
                    >
                      <Square className="h-4 w-4" /> Finalizar
                    </button>
                  )}
                </div>

                {emPausa && (
                  <button
                    onClick={() => setShowModalFinalizar(true)}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-card border border-border text-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-muted transition-all"
                  >
                    <Square className="h-4 w-4" /> Finalizar mesmo assim
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Painel de OPs */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Acompanhamento de OPs
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Planejado x realizado por ordem de produção</p>
            </div>

            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {resumos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <ClipboardList className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Nenhuma OP na carteira</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie ordens de produção no módulo PCP para começar.</p>
                </div>
              )}

              {resumos.map(resumo => {
                const badge = badgeStatus(resumo.pct)
                const expandida = opExpandida === resumo.op.id

                return (
                  <div key={resumo.op.id} className="p-5">
                    <div className="flex items-start justify-between cursor-pointer" onClick={() => setOpExpandida(expandida ? null : resumo.op.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{resumo.op.numero_op}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">{resumo.op.produto_codigo}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.classes}`}>{badge.label}</span>
                          {resumo.fechada && <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full border border-green-500/20">Encerrada</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Meta: <strong className="text-foreground">{resumo.op.quantidade} peças</strong>
                          {" · "}Programada: <strong className="text-foreground">{resumo.op.data_programacao?.split("-").reverse().join("/")}</strong>
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-xl font-bold text-foreground">{resumo.pct.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">{resumo.totalProduzidas}/{resumo.op.quantidade} pç</p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${resumo.fechada ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${resumo.pct}%` }}
                      />
                    </div>

                    <div className="mt-3 flex gap-4 text-[11px]">
                      {resumo.totalSegundos > 0 && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatarTempo(resumo.totalSegundos)}
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
                      {resumo.aps.length > 0 && (
                        <span className="text-muted-foreground">{resumo.aps.length} apontamento{resumo.aps.length > 1 ? "s" : ""}</span>
                      )}
                    </div>

                    {expandida && resumo.aps.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Histórico</p>
                        {resumo.aps.map(ap => (
                          <div key={ap.id} className="flex items-start justify-between p-3 bg-muted/30 border border-border rounded-xl text-xs gap-3">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-bold text-foreground">{ap.operacao_nome || "Operação"}</span>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {formatarTempo(ap.cronometro_total_segundos || 0)}
                                </span>
                                <span className="text-foreground font-bold">{ap.pecas_produzidas} pç</span>
                                {ap.pecas_refugo > 0 && <span className="text-destructive">{ap.pecas_refugo} refugo</span>}
                                {ap.pecas_retrabalho > 0 && <span className="text-amber-500">{ap.pecas_retrabalho} retrabalho</span>}
                              </div>
                              {ap.encerramento && ap.encerramento !== "continuar" && (
                                <span className="text-[10px] text-muted-foreground italic mt-0.5">
                                  {ap.encerramento === "encerrar" ? "OP encerrada" : "Encerramento parcial"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {expandida && resumo.aps.length === 0 && (
                      <div className="mt-4 px-3 py-4 bg-muted/20 border border-dashed border-border rounded-xl text-center">
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

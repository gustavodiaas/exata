"use client"

import React, { useState } from "react"
import { ShieldAlert, Users, Plus, Building2, Mail, Power } from "lucide-react"

export function MasterTab() {
  const [isAdding, setIsAdding] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Painel Master
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gestão absoluta de clientes, assinaturas e níveis de acesso.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="h-10 px-4 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-md hover:opacity-90 transition-all"
        >
          {isAdding ? "Cancelar" : <><Plus className="h-4 w-4" /> Novo Cliente</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Credenciar Nova Fábrica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome da Empresa</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Indústria Exemplo Ltda" className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">E-mail do Administrador</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="admin@industria.com" className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-input text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
              </div>
            </div>
          </div>
          <button className="mt-4 h-10 w-full bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-xl shadow-md hover:opacity-90 transition-all">
            Gerar Convite de Acesso
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Fábricas Operando</h3>
        </div>
        
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                <tr>
                  <th className="px-6 py-3">Empresa</th>
                  <th className="px-6 py-3">Admin</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Linha de exemplo estática para visualizar o design */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-bold text-foreground">Sua Empresa Teste</td>
                  <td className="px-6 py-4 text-muted-foreground">gustavodiaass@yahoo.com</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                      Ativo
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Suspender Acesso">
                      <Power className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

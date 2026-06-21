"use client"

import React from "react"
import { ChevronDown } from "lucide-react"

interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  size?: "sm" | "md"
}

export function NativeSelect({ className = "", size = "md", children, ...props }: NativeSelectProps) {
  const h = size === "sm" ? "h-9 text-xs" : "h-11 text-sm"
  return (
    <div className="relative w-full">
      <select
        {...props}
        className={`
          w-full ${h} pl-4 pr-10 rounded-xl border border-border bg-input text-foreground
          outline-none focus:ring-2 focus:ring-primary transition-all appearance-none cursor-pointer
          ${className}
        `}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  )
}

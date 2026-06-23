"use client"

import React from "react"
import { ChevronDown } from "lucide-react"

interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  variant?: "sm" | "md"
}

export function NativeSelect({ className = "", variant = "md", children, ...props }: NativeSelectProps) {
  const h = variant === "sm" ? "h-9 text-xs" : "h-11 text-sm"
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

interface NativeDateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function NativeDateInput({ className = "", ...props }: NativeDateInputProps) {
  return (
    <div className="relative w-full">
      <input
        {...props}
        type="date"
        className={`
          w-full h-9 pl-4 pr-4 rounded-xl border border-border bg-input text-foreground text-xs
          outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer
          [color-scheme:light] dark:[color-scheme:dark]
          ${className}
        `}
      />
    </div>
  )
}

interface NativeTimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function NativeTimeInput({ className = "", ...props }: NativeTimeInputProps) {
  return (
    <div className="relative w-full">
      <input
        {...props}
        type="time"
        className={`
          w-full h-10 pl-4 pr-4 rounded-xl border border-border bg-input text-foreground text-sm
          outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer
          [color-scheme:light] dark:[color-scheme:dark]
          ${className}
        `}
      />
    </div>
  )
}

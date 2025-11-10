"use client";
import * as React from "react";

// Minimal native select facade for existing API usage
export function Select({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>
}
export function SelectTrigger({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`h-10 w-full rounded-md border px-3 text-left ${className}`} {...props}>{children}</button>
}
export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span className="text-sm text-muted-foreground">{placeholder}</span>
}
export function SelectContent({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 ${className}`}>{children}</div>
}
export function SelectItem({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) {
  return <div className="px-3 py-2 text-sm hover:bg-accent rounded cursor-pointer" onClick={onClick}>{children}</div>
}
export default Select;

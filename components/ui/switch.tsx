"use client";
import * as React from "react";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Switch({ className = "", ...props }: SwitchProps) {
  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <input type="checkbox" className="peer hidden" {...props} />
      <span className="w-10 h-6 rounded-full bg-muted relative transition-colors peer-checked:bg-primary">
        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-background transition-all peer-checked:left-5" />
      </span>
    </label>
  )
}
export default Switch;

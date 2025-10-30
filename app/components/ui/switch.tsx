"use client";
import * as React from "react";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ 
  className = "", 
  checked, 
  onCheckedChange,
  disabled,
  ...props 
}: SwitchProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked);
  };

  return (
    <label className={`relative inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
      <div className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 ${className}`}></div>
    </label>
  );
}

export default Switch;

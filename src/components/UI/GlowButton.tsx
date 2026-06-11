import React from 'react';
import { cn } from '@/lib/utils';

interface GlowButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  active?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  active = false,
  className,
  icon,
}) => {
  const variantStyles = {
    primary: 'border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 hover:shadow-cyan-500/30',
    secondary: 'border-slate-500/50 text-slate-300 hover:bg-slate-500/20 hover:shadow-slate-500/30',
    success: 'border-green-500/50 text-green-300 hover:bg-green-500/20 hover:shadow-green-500/30',
    warning: 'border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/20 hover:shadow-yellow-500/30',
    danger: 'border-red-500/50 text-red-300 hover:bg-red-500/20 hover:shadow-red-500/30',
  };

  const activeStyles = {
    primary: 'bg-cyan-500/30 shadow-cyan-500/40',
    secondary: 'bg-slate-500/30 shadow-slate-500/40',
    success: 'bg-green-500/30 shadow-green-500/40',
    warning: 'bg-yellow-500/30 shadow-yellow-500/40',
    danger: 'bg-red-500/30 shadow-red-500/40',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md border',
        'bg-slate-900/60 backdrop-blur-sm',
        'font-mono tracking-wide',
        'transition-all duration-200',
        'hover:shadow-lg',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        active && activeStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

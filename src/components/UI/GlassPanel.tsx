import React from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className,
  title,
  icon,
  collapsible = false,
  defaultCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <div
      className={cn(
        'rounded-lg border border-cyan-500/30 bg-slate-900/80 backdrop-blur-md shadow-lg shadow-cyan-500/10',
        className
      )}
    >
      {title && (
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 border-b border-cyan-500/20',
            collapsible && 'cursor-pointer hover:bg-cyan-500/10 transition-colors'
          )}
          onClick={() => collapsible && setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-2">
            {icon && <span className="text-cyan-400">{icon}</span>}
            <h3 className="text-sm font-semibold text-cyan-300 font-mono tracking-wider">
              {title}
            </h3>
          </div>
          {collapsible && (
            <span className="text-cyan-500 text-xs transition-transform duration-200"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          )}
        </div>
      )}
      <div className={cn(
        'transition-all duration-300 overflow-hidden',
        collapsed ? 'max-h-0 py-0' : 'p-4'
      )}>
        {children}
      </div>
    </div>
  );
};

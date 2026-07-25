import React from 'react';
import { cn } from '../utils/cn';

type DefaultAvatarProps = {
  className?: string;
  iconClassName?: string;
};

/** Staunton-style king mark used when a user has no profile photo. */
export function KingPieceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.15 2.2h1.7v1.55h1.55v1.55H12.85v1.2h-1.7v-1.2H9.6V3.75h1.55V2.2Z" />
      <path d="M8.35 7.35c0-.45.35-.8.8-.8h5.7c.45 0 .8.35.8.8v.55c0 .3-.2.55-.45.7l-.7.4H9.5l-.7-.4a.8.8 0 0 1-.45-.7v-.55Z" />
      <path d="M9.15 9.85h5.7l.55 1.15c.15.3 0 .65-.3.75l-.85.25H9.75l-.85-.25a.55.55 0 0 1-.3-.75l.55-1.15Z" />
      <path d="M8.55 12.45c1.55 1.35 3.05 1.95 3.45 1.95s1.9-.6 3.45-1.95l.55 5.4c.05.55-.35 1.05-.9 1.05H8.9c-.55 0-.95-.5-.9-1.05l.55-5.4Z" />
      <path d="M7.4 20.15h9.2c.5 0 .9.35.95.85l.05.45c.05.4-.25.75-.65.75H7.05c-.4 0-.7-.35-.65-.75l.05-.45c.05-.5.45-.85.95-.85Z" />
    </svg>
  );
}

export function DefaultAvatar({ className, iconClassName }: DefaultAvatarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-b from-slate-100 to-slate-200 text-slate-700 ring-1 ring-slate-200/80 dark:from-white/20 dark:to-white/10 dark:text-white dark:ring-white/15',
        className
      )}
    >
      <KingPieceIcon className={cn('h-[58%] w-[58%]', iconClassName)} />
    </div>
  );
}

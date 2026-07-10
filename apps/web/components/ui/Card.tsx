import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-3xl bg-white shadow-lg border border-zinc-100 ${className}`}
    >
      {children}
    </div>
  );
}
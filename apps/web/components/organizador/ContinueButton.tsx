"use client";

interface ContinueButtonProps {
  enabled: boolean;
  onClick: () => void;
}

export default function ContinueButton({
  enabled,
  onClick,
}: ContinueButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className={`w-full rounded-3xl py-5 text-lg font-bold transition ${
        enabled
          ? "bg-violet-700 text-white hover:bg-violet-800"
          : "cursor-not-allowed bg-zinc-300 text-zinc-500"
      }`}
    >
      {enabled
        ? "Finalizar cadastro →"
        : "Conecte um gateway para continuar"}
    </button>
  );
}
"use client";

import { useState } from "react";

export default function TestePage() {
  const [texto, setTexto] = useState("Não clicou");

  return (
    <main className="min-h-screen flex items-center justify-center">
      <button
        onClick={() => setTexto("Funcionou!")}
        className="rounded bg-blue-600 px-6 py-3 text-white"
      >
        Clique aqui
      </button>

      <p className="ml-6 text-xl">{texto}</p>
    </main>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CadastroComprador() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitou, setAceitou] = useState(false);

  function cadastrar() {
    if (!nome || !cpf || !telefone || !email || !senha) {
      alert("Preencha todos os campos.");
      return;
    }

    if (senha !== confirmarSenha) {
      alert("As senhas não conferem.");
      return;
    }

    if (!aceitou) {
      alert("Aceite os termos de uso.");
      return;
    }

    router.push("/cadastro/sucesso-comprador");
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow">

        <h1 className="text-5xl font-black text-center">
          Sorte<span className="text-violet-600">X</span>
        </h1>

        <h2 className="mt-8 text-3xl font-bold text-center">
          Criar conta
        </h2>

        <div className="mt-8 space-y-4">

          <input
            className="w-full rounded-2xl border p-4"
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border p-4"
            placeholder="CPF"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border p-4"
            placeholder="WhatsApp"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border p-4"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-2xl border p-4"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-2xl border p-4"
            placeholder="Confirmar senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aceitou}
              onChange={(e) => setAceitou(e.target.checked)}
            />
            Aceito os Termos de Uso.
          </label>

          <button
            onClick={cadastrar}
            className="w-full rounded-2xl bg-violet-700 py-4 font-bold text-white"
          >
            Criar conta
          </button>

        </div>

      </div>
    </main>
  );
}
"use client";

export default function PerfilPage() {
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-black">
        👤 Meu Perfil
      </h1>

      <div className="mt-6 rounded-3xl border bg-white p-5 shadow">

        <p className="font-semibold">
          Nome
        </p>

        <p className="text-zinc-500">
          Felipe
        </p>

        <hr className="my-4" />

        <p className="font-semibold">
          E-mail
        </p>

        <p className="text-zinc-500">
          usuario@email.com
        </p>

        <hr className="my-4" />

        <p className="font-semibold">
          CPF
        </p>

        <p className="text-zinc-500">
          •••.•••.•••-••
        </p>

      </div>
    </main>
  );
}
"use client";

export default function FavoritosPage() {
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-black">
        ❤️ Favoritos
      </h1>

      <p className="mt-3 text-zinc-500">
        Aqui ficam as campanhas salvas.
      </p>

      <div className="mt-6 rounded-3xl border bg-white p-5 shadow">
        <h2 className="font-bold">
          Nenhum favorito.
        </h2>

        <p className="mt-2 text-sm text-zinc-500">
          Adicione campanhas aos favoritos para encontrá-las rapidamente.
        </p>
      </div>
    </main>
  );
}
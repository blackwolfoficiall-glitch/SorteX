import NumbersGrid from "../../../components/NumbersGrid";

export default function CampanhaPage() {
  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-xl">

        <div className="grid gap-10 lg:grid-cols-2">

          {/* Imagem do prêmio */}
          <div className="flex h-[500px] items-center justify-center rounded-3xl bg-gray-200">
            <span className="text-xl text-gray-500">
              Foto do Prêmio
            </span>
          </div>

          {/* Informações */}
          <div>

            <span className="rounded-full bg-violet-100 px-4 py-2 font-semibold text-violet-700">
              Campanha Oficial
            </span>

            <h1 className="mt-6 text-4xl font-bold">
              iPhone 16 Pro Max
            </h1>

            <p className="mt-4 text-gray-500">
              Escolha seus números e participe da campanha oficial da
              SorteX com total segurança.
            </p>

            <div className="mt-8">
              <div className="mb-2 flex justify-between">
                <span>75% vendido</span>
                <span>750 / 1000</span>
              </div>

              <div className="h-4 rounded-full bg-gray-200">
                <div className="h-4 w-3/4 rounded-full bg-violet-600"></div>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-6">

              <div className="rounded-2xl border p-5">
                <p className="text-sm text-gray-500">
                  Valor da cota
                </p>

                <h2 className="mt-2 text-3xl font-bold text-green-600">
                  R$ 0,50
                </h2>
              </div>

              <div className="rounded-2xl border p-5">
                <p className="text-sm text-gray-500">
                  Restantes
                </p>

                <h2 className="mt-2 text-3xl font-bold text-violet-600">
                  250
                </h2>
              </div>

            </div>

            <button className="mt-10 w-full rounded-2xl bg-green-600 py-5 text-lg font-bold text-white transition hover:bg-green-700">
              Comprar Agora
            </button>

          </div>

        </div>

        <div className="mt-16">
          <NumbersGrid />
        </div>

      </div>
    </main>
  );
}
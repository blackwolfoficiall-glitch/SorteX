export default function Hero() {
  return (
    <section className="bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center">

        <span className="mb-6 rounded-full bg-[#EEF2FF] px-4 py-2 text-sm font-semibold text-[#6C3BFF]">
          🚀 Plataforma inteligente para campanhas premiadas
        </span>

        <h1 className="max-w-4xl text-5xl font-extrabold leading-tight text-gray-900 md:text-7xl">
          A plataforma que ajuda
          <span className="text-[#6C3BFF]">
            {" "}organizadores{" "}
          </span>
          a venderem mais.
        </h1>

        <p className="mt-8 max-w-3xl text-xl leading-9 text-gray-600">
          Crie campanhas premiadas, utilize CRM inteligente, automações,
          Inteligência Artificial e ferramentas que aumentam suas vendas
          em um único lugar.
        </p>

        <div className="mt-16 grid w-full max-w-5xl gap-8 md:grid-cols-2">

          <div className="rounded-3xl border border-gray-200 bg-white p-10 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-6 text-6xl">🎟️</div>

            <h2 className="text-3xl font-bold text-gray-900">
              Sou Comprador
            </h2>

            <p className="mt-4 text-gray-600">
              Participe das campanhas premiadas com total segurança.
            </p>

            <button className="mt-8 w-full rounded-2xl bg-[#16A34A] py-4 text-lg font-semibold text-white transition hover:opacity-90">
              Começar
            </button>
          </div>

          <div className="rounded-3xl border border-[#6C3BFF]/20 bg-[#F8F5FF] p-10 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-6 text-6xl">🚀</div>

            <h2 className="text-3xl font-bold text-gray-900">
              Sou Organizador
            </h2>

            <p className="mt-4 text-gray-600">
              Crie campanhas, utilize IA, CRM, afiliados e automações.
            </p>

            <button className="mt-8 w-full rounded-2xl bg-[#6C3BFF] py-4 text-lg font-semibold text-white transition hover:opacity-90">
              Quero Organizar
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
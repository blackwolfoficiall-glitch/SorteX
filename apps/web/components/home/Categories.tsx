export default function Categories() {
  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold mb-6">Categorias</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border p-6 text-center bg-white shadow-sm">
          🚗
          <p className="mt-2 font-semibold">Veículos</p>
        </div>

        <div className="rounded-xl border p-6 text-center bg-white shadow-sm">
          🏍️
          <p className="mt-2 font-semibold">Motos</p>
        </div>

        <div className="rounded-xl border p-6 text-center bg-white shadow-sm">
          📱
          <p className="mt-2 font-semibold">Eletrônicos</p>
        </div>

        <div className="rounded-xl border p-6 text-center bg-white shadow-sm">
          💰
          <p className="mt-2 font-semibold">Dinheiro</p>
        </div>
      </div>
    </section>
  );
}
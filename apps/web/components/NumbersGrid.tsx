export default function NumbersGrid() {
  return (
    <section className="mt-16">
      <h2 className="text-3xl font-bold text-center mb-8">
        Escolha seus números
      </h2>

      <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
        {Array.from({ length: 100 }, (_, i) => (
          <button
            key={i}
            className="h-12 rounded-xl border border-gray-300 hover:bg-violet-600 hover:text-white transition"
          >
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
    </section>
  );
}
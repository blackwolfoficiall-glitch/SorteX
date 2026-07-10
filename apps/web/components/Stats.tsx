export default function Stats() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">

        <div>
          <h2 className="text-4xl font-bold text-[#6C3BFF]">+10k</h2>
          <p className="text-gray-600 mt-2">Usuários</p>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-[#2563EB]">+500</h2>
          <p className="text-gray-600 mt-2">Campanhas</p>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-[#16A34A]">100%</h2>
          <p className="text-gray-600 mt-2">Segurança</p>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-[#6C3BFF]">IA</h2>
          <p className="text-gray-600 mt-2">Automação Inteligente</p>
        </div>

      </div>
    </section>
  );
}
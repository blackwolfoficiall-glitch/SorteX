"use client";

import { Gift, Calendar, DollarSign, ImageIcon, Hash } from "lucide-react";

export default function CriarCampanha() {
  return (
    <main className="min-h-screen bg-gray-50 flex justify-center py-10 px-6">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-10">

        <h1 className="text-4xl font-bold text-[#6C3BFF] mb-2">
          Nova Campanha
        </h1>

        <p className="text-gray-500 mb-10">
          Crie uma campanha premiada em poucos minutos.
        </p>

        <div className="space-y-6">

          <div>
            <label className="font-medium">Nome da campanha</label>
            <input
              className="mt-2 w-full border rounded-xl p-4 outline-none focus:border-[#6C3BFF]"
              placeholder="Ex: iPhone 16 Pro Max"
            />
          </div>

          <div>
            <label className="font-medium">Descrição</label>
            <textarea
              rows={4}
              className="mt-2 w-full border rounded-xl p-4 outline-none focus:border-[#6C3BFF]"
              placeholder="Descreva sua campanha..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div>
              <label className="font-medium">Prêmio</label>

              <div className="mt-2 flex items-center border rounded-xl p-4">
                <Gift className="mr-3 text-[#6C3BFF]" />
                <input
                  className="w-full outline-none"
                  placeholder="Nome do prêmio"
                />
              </div>
            </div>

            <div>
              <label className="font-medium">Valor da cota</label>

              <div className="mt-2 flex items-center border rounded-xl p-4">
                <DollarSign className="mr-3 text-green-600" />
                <input
                  className="w-full outline-none"
                  placeholder="10,00"
                />
              </div>
            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div>
              <label className="font-medium">Quantidade de números</label>

              <div className="mt-2 flex items-center border rounded-xl p-4">
                <Hash className="mr-3 text-blue-600" />
                <input
                  className="w-full outline-none"
                  placeholder="10000"
                />
              </div>
            </div>

            <div>
              <label className="font-medium">Data do sorteio</label>

              <div className="mt-2 flex items-center border rounded-xl p-4">
                <Calendar className="mr-3 text-orange-500" />
                <input
                  type="date"
                  className="w-full outline-none"
                />
              </div>
            </div>

          </div>

          <div>
            <label className="font-medium">Imagem do prêmio</label>

            <div className="mt-2 border-2 border-dashed rounded-2xl p-10 text-center">

              <ImageIcon
                size={50}
                className="mx-auto text-gray-400 mb-4"
              />

              <p className="text-gray-500">
                Arraste uma imagem ou clique para enviar
              </p>

            </div>
          </div>

          <button
            className="w-full bg-[#16A34A] text-white rounded-xl py-4 text-lg font-semibold hover:bg-green-700 transition"
          >
            Publicar Campanha
          </button>

        </div>

      </div>
    </main>
  );
}
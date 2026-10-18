"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { API_URL } from "@/lib/api";

type Usuario = {
  id: number;
  nome: string;
  email: string;
};

type ItemAnalise = {
  produto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

type AnaliseComprovante = {
  estabelecimento: string | null;
  dataCompra: string | null;
  total: number | null;
  categoria: string | null;
  itens: ItemAnalise[];
};

type ItemGasto = {
  id: number;
  produto: string;
  quantidade: number;
  valorUnitario: string | number;
  valorTotal: string | number | null;
};

type Gasto = {
  id: number;
  estabelecimento: string | null;
  total: string | number;
  categoria: string | null;
  dataCompra: string | null;
  imagemUrl: string | null;
  criadoEm: string;
  itens: ItemGasto[];
};


export default function HomePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [gastos, setGastos] =
    useState<Gasto[]>([]);

  const [gastoSelecionado, setGastoSelecionado] =
    useState<Gasto | null>(null);

  const [analiseAtual, setAnaliseAtual] =
    useState<AnaliseComprovante | null>(null);

  const [imagemAtualUrl, setImagemAtualUrl] =
    useState<string | null>(null);

  const [carregandoPagina, setCarregandoPagina] =
    useState(true);

  const [processando, setProcessando] =
    useState(false);

  const [mensagem, setMensagem] =
    useState("");

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    iniciarAplicacao();
  }, []);

  useEffect(() => {
    if (!gastoSelecionado) return;

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGastoSelecionado(null);
      }
    }

    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [gastoSelecionado]);

  async function iniciarAplicacao() {
    const token = localStorage.getItem("token");
    const usuarioSalvo =
      localStorage.getItem("usuario");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (usuarioSalvo) {
      try {
        setUsuario(
          JSON.parse(usuarioSalvo)
        );
      } catch {
        localStorage.removeItem("usuario");
      }
    }

    await carregarGastos(token);
  }

  async function carregarGastos(
    token?: string
  ) {
    try {
      const tokenAtual =
        token ||
        localStorage.getItem("token");

      if (!tokenAtual) {
        window.location.href = "/login";
        return;
      }

      const resposta = await fetch(
        `${API_URL}/gastos`,
        {
          headers: {
            Authorization:
              `Bearer ${tokenAtual}`
          }
        }
      );

      if (resposta.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");

        window.location.href = "/login";
        return;
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem ||
          "Erro ao buscar gastos."
        );
      }

      setGastos(dados);
      setErro("");

    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar gastos."
      );

    } finally {
      setCarregandoPagina(false);
    }
  }

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    window.location.href = "/login";
  }

  function abrirCamera() {
    if (processando || analiseAtual) {
      return;
    }

    inputRef.current?.click();
  }

  async function selecionarImagem(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const arquivo =
      event.target.files?.[0];

    if (!arquivo) {
      return;
    }

    await processarComprovante(
      arquivo
    );

    event.target.value = "";
  }

  async function processarComprovante(
    arquivo: File
  ) {
    try {
      setProcessando(true);
      setMensagem("");
      setErro("");
      setAnaliseAtual(null);
      setImagemAtualUrl(null);

      const token =
        localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      /*
        PASSO 1
        Envia a foto
      */

      const formData =
        new FormData();

      formData.append(
        "comprovante",
        arquivo
      );

      setMensagem(
        "📤 Enviando comprovante..."
      );

      const respostaUpload =
        await fetch(
          `${API_URL}/gastos/foto`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`
            },

            body: formData
          }
        );

      const upload =
        await respostaUpload.json();

      if (!respostaUpload.ok) {
        throw new Error(
          upload.mensagem ||
          "Erro ao enviar comprovante."
        );
      }

      setImagemAtualUrl(
        upload.imagemUrl
      );

      /*
        PASSO 2
        IA analisa sem salvar
      */

      setMensagem(
        "🤖 IA analisando comprovante..."
      );

      const respostaAnalise =
        await fetch(
          `${API_URL}/gastos/analisar`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`
            },

            body: JSON.stringify({
              imagemUrl:
                upload.imagemUrl
            })
          }
        );

      const resultado =
        await respostaAnalise.json();

      if (!respostaAnalise.ok) {
        throw new Error(
          resultado.detalhe ||
          resultado.mensagem ||
          "Erro ao analisar comprovante."
        );
      }

      setAnaliseAtual(
        resultado.dados
      );

      setMensagem(
        "✅ Confira os dados antes de salvar."
      );

    } catch (error) {
      console.error(
        "ERRO AO PROCESSAR:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao processar comprovante."
      );

      setMensagem("");

    } finally {
      setProcessando(false);
    }
  }

  async function salvarAnalise() {
    try {
      if (
        !analiseAtual ||
        !imagemAtualUrl
      ) {
        return;
      }

      if (
        analiseAtual.total === null
      ) {
        setErro(
          "Informe o valor total antes de salvar."
        );

        return;
      }

      const token =
        localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      setProcessando(true);
      setErro("");

      setMensagem(
        "💾 Salvando gasto..."
      );

      const resposta =
        await fetch(
          `${API_URL}/gastos`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`
            },

            body: JSON.stringify({
              estabelecimento:
                analiseAtual.estabelecimento,

              total:
                analiseAtual.total,

              categoria:
                analiseAtual.categoria,

              dataCompra:
                analiseAtual.dataCompra,

              imagemUrl:
                imagemAtualUrl,

              itens:
                analiseAtual.itens
            })
          }
        );

      const dados =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem ||
          "Erro ao salvar gasto."
        );
      }

      setAnaliseAtual(null);
      setImagemAtualUrl(null);

      setMensagem(
        "✅ Gasto salvo com sucesso!"
      );

      await carregarGastos(token);

    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao salvar gasto."
      );

    } finally {
      setProcessando(false);
    }
  }

  function cancelarAnalise() {
    setAnaliseAtual(null);
    setImagemAtualUrl(null);
    setMensagem("");
    setErro("");
  }

  const totalGasto =
    gastos.reduce(
      (soma, gasto) =>
        soma +
        Number(gasto.total),
      0
    );

  function formatarDinheiro(
    valor: number
  ) {
    return valor.toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL"
      }
    );
  }

  function formatarData(
    data: string | null
  ) {
    if (!data) {
      return "Data não informada";
    }

    return new Date(
      data
    ).toLocaleDateString(
      "pt-BR",
      {
        timeZone: "UTC"
      }
    );
  }

  if (carregandoPagina) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">
          Carregando gastos...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">

      <div className="mx-auto min-h-screen max-w-md bg-white">

        <header className="px-6 pb-5 pt-8">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-2xl">
                📸
              </div>

              <div>
                <h1 className="text-2xl font-bold">
                  Controle de Gastos com IA
                </h1>

                <p className="text-sm text-slate-500">
                  Olá,{" "}
                  {usuario?.nome ||
                    "usuário"}
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={sair}
              className="text-sm font-medium text-red-500"
            >
              Sair
            </button>

          </div>

        </header>

        <section className="px-6">

          {/* TOTAL */}

          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">

            <p className="text-sm text-slate-300">
              Total gasto
            </p>

            <h2 className="mt-2 text-4xl font-bold">
              {formatarDinheiro(
                totalGasto
              )}
            </h2>

            <div className="mt-5 flex justify-between border-t border-slate-700 pt-4">

              <span className="text-sm text-slate-300">
                Comprovantes
              </span>

              <span className="font-semibold">
                {gastos.length}
              </span>

            </div>

          </div>

          {/* CÂMERA */}

          <div className="mt-6 rounded-3xl border border-slate-200 p-6 text-center shadow-sm">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl">
              📷
            </div>

            <h2 className="mt-4 text-xl font-bold">
              Fotografe seu comprovante
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tire uma foto da nota.
              A IA identifica estabelecimento,
              valor, data e itens.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={
                selecionarImagem
              }
            />

            <button
              type="button"
              onClick={abrirCamera}
              disabled={
                processando ||
                !!analiseAtual
              }
              className="mt-6 w-full rounded-2xl bg-emerald-500 px-6 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >

              {processando
                ? "🤖 Processando..."
                : analiseAtual
                  ? "Confira a nota abaixo"
                  : "📷 Fotografar comprovante"}

            </button>

            {mensagem && (
              <p className="mt-4 text-sm font-medium text-emerald-600">
                {mensagem}
              </p>
            )}

            {erro && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {erro}
              </p>
            )}

            {/* CONFIRMAÇÃO */}

            {analiseAtual && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">

                <h3 className="text-lg font-bold">
                  Confira o comprovante
                </h3>

                <label className="mt-4 block text-xs font-medium text-slate-500">
                  Estabelecimento
                </label>

                <input
                  value={
                    analiseAtual.estabelecimento ??
                    ""
                  }
                  onChange={(event) =>
                    setAnaliseAtual({
                      ...analiseAtual,
                      estabelecimento:
                        event.target.value
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />

                <label className="mt-4 block text-xs font-medium text-slate-500">
                  Categoria
                </label>

                <input
                  value={
                    analiseAtual.categoria ??
                    ""
                  }
                  onChange={(event) =>
                    setAnaliseAtual({
                      ...analiseAtual,
                      categoria:
                        event.target.value
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />

                <label className="mt-4 block text-xs font-medium text-slate-500">
                  Data da compra
                </label>

                <input
                  type="date"
                  value={
                    analiseAtual.dataCompra ??
                    ""
                  }
                  onChange={(event) =>
                    setAnaliseAtual({
                      ...analiseAtual,
                      dataCompra:
                        event.target.value ||
                        null
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />

                <label className="mt-4 block text-xs font-medium text-slate-500">
                  Total
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    analiseAtual.total ??
                    ""
                  }
                  onChange={(event) =>
                    setAnaliseAtual({
                      ...analiseAtual,
                      total:
                        event.target.value
                          ? Number(
                              event.target.value
                            )
                          : null
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xl font-bold text-emerald-700"
                />

                {analiseAtual.itens.length > 0 && (
                  <div className="mt-5">

                    <p className="mb-3 font-semibold">
                      Itens identificados
                    </p>

                    <div className="space-y-2">

                      {analiseAtual.itens.map(
                        (item, index) => (

                          <div
                            key={index}
                            className="rounded-xl bg-white p-3 text-sm"
                          >
                            <p className="font-medium">
                              {item.produto}
                            </p>

                            <p className="mt-1 text-slate-500">
                              {item.quantidade}
                              {" × "}
                              {formatarDinheiro(
                                item.valorUnitario
                              )}
                              {" = "}
                              {formatarDinheiro(
                                item.valorTotal
                              )}
                            </p>
                          </div>

                        )
                      )}

                    </div>

                  </div>
                )}

                <div className="mt-6 flex gap-3">

                  <button
                    type="button"
                    onClick={salvarAnalise}
                    disabled={processando}
                    className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    ✅ Salvar gasto
                  </button>

                  <button
                    type="button"
                    onClick={cancelarAnalise}
                    disabled={processando}
                    className="flex-1 rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                </div>

              </div>
            )}

          </div>

          {/* HISTÓRICO */}

          <div className="pb-10 pt-8">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-lg font-bold">
                Últimos gastos
              </h2>

              <span className="text-sm text-slate-400">
                {gastos.length}
              </span>

            </div>

            {gastos.length === 0 ? (

              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center">

                <div className="text-3xl">
                  🧾
                </div>

                <p className="mt-3 text-slate-600">
                  Nenhum gasto registrado
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {gastos
                  .slice(0, 10)
                  .map((gasto) => (

                    <button
                      key={gasto.id}
                      type="button"
                      onClick={() => setGastoSelecionado(gasto)}
                      aria-label={`Ver detalhes do gasto em ${gasto.estabelecimento || "estabelecimento não identificado"}`}
                      className="block w-full rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
                    >

                      <div className="flex items-center justify-between gap-4">

                        <div>

                          <p className="font-semibold text-slate-800">
                            {gasto.estabelecimento ||
                              "Estabelecimento não identificado"}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">

                            {gasto.categoria ||
                              "Sem categoria"}

                            {" • "}

                            {formatarData(
                              gasto.dataCompra
                            )}

                          </p>

                        </div>

                        <p className="whitespace-nowrap font-bold text-emerald-600">
                          {formatarDinheiro(
                            Number(
                              gasto.total
                            )
                          )}
                        </p>

                      </div>

                      <span className="mt-3 block text-right text-xs font-semibold text-emerald-700">
                        Ver detalhes e itens →
                      </span>
                    </button>

                  ))}

              </div>

            )}

          </div>

        </section>

      </div>


      {gastoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-detalhes-gasto"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 text-slate-900 shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="titulo-detalhes-gasto" className="text-xl font-bold">
                Detalhes da compra
              </h2>
              <button
                type="button"
                onClick={() => setGastoSelecionado(null)}
                aria-label="Fechar detalhes da compra"
                className="rounded-full p-2 text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">Estabelecimento</p>
                <p className="font-semibold">
                  {gastoSelecionado.estabelecimento || "Não identificado"}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs text-slate-500">Data da compra</p>
                  <p className="text-sm font-medium">
                    {formatarData(gastoSelecionado.dataCompra)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Categoria</p>
                  <p className="text-sm font-medium">
                    {gastoSelecionado.categoria || "Sem categoria"}
                  </p>
                </div>
              </div>
            </div>

            <h3 className="mt-6 font-bold">
              Itens comprados ({gastoSelecionado.itens?.length ?? 0})
            </h3>

            {gastoSelecionado.itens?.length ? (
              <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
                {gastoSelecionado.itens.map((item) => (
                  <li key={item.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{item.produto}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.quantidade} × {formatarDinheiro(Number(item.valorUnitario))}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">
                        {formatarDinheiro(
                          item.valorTotal !== null
                            ? Number(item.valorTotal)
                            : Number(item.valorUnitario) * item.quantidade
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Nenhum item foi identificado nesse comprovante.
              </p>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="font-semibold">Total da compra</span>
              <strong className="text-xl text-emerald-700">
                {formatarDinheiro(Number(gastoSelecionado.total))}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => setGastoSelecionado(null)}
              className="mt-6 w-full rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              Fechar
            </button>
          </section>
        </div>
      )}

    </main>
  );
}
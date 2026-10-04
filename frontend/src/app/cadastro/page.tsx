"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

const TAMANHO_MINIMO_SENHA = 6;

const classeCampo =
  "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500";

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (senha.length < TAMANHO_MINIMO_SENHA) {
      setErro(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const respostaCadastro = await fetch(`${API_URL}/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome, email, senha }),
      });

      const cadastro = await respostaCadastro.json();

      if (!respostaCadastro.ok) {
        throw new Error(
          cadastro.mensagem || "Não foi possível criar a conta."
        );
      }

      // Conta criada: entra direto, sem pedir login de novo
      const respostaLogin = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, senha }),
      });

      const login = await respostaLogin.json();

      if (!respostaLogin.ok) {
        router.push("/login/");
        return;
      }

      localStorage.setItem("token", login.token);
      localStorage.setItem("usuario", JSON.stringify(login.usuario));

      router.push("/");
    } catch (error) {
      console.error("ERRO NO CADASTRO:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao criar a conta."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl">
            📸
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Criar conta
          </h1>

          <p className="mt-2 text-slate-500">
            Comece a controlar seus gastos com IA
          </p>
        </div>

        <form
          onSubmit={cadastrar}
          className="mt-8 space-y-5"
        >
          <div>
            <label htmlFor="nome" className="text-sm font-medium text-slate-700">
              Nome
            </label>

            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              required
              className={classeCampo}
            />
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              E-mail
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
              className={classeCampo}
            />
          </div>

          <div>
            <label htmlFor="senha" className="text-sm font-medium text-slate-700">
              Senha
            </label>

            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder={`Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres`}
              autoComplete="new-password"
              required
              className={classeCampo}
            />
          </div>

          <div>
            <label htmlFor="confirmacao" className="text-sm font-medium text-slate-700">
              Confirme a senha
            </label>

            <input
              id="confirmacao"
              type="password"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              required
              className={classeCampo}
            />
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-sm text-red-600">
                {erro}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Já tem conta?{" "}
          <Link
            href="/login/"
            className="font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Entrar
          </Link>
        </p>

      </div>
    </main>
  );
}

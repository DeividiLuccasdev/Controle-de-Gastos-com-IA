"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";



export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          senha,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "E-mail ou senha inválidos."
        );
      }

      localStorage.setItem("token", dados.token);

      localStorage.setItem(
        "usuario",
        JSON.stringify(dados.usuario)
      );

      window.location.href = "/";
    } catch (error) {
      console.error("ERRO NO LOGIN:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao realizar login."
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
            Controle de Gastos com IA
          </h1>

          <p className="mt-2 text-slate-500">
            Entre para controlar seus gastos
          </p>
        </div>

        <form
          onSubmit={entrar}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="seu@email.com"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="senha"
              className="text-sm font-medium text-slate-700"
            >
              Senha
            </label>

            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(event) =>
                setSenha(event.target.value)
              }
              placeholder="Sua senha"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500"
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
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro/"
            className="font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Criar conta
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-slate-400">
          Controle seus gastos fotografando seus comprovantes.
        </p>

      </div>
    </main>
  );
}
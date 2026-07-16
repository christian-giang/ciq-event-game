import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/session";
import { CodeEntry } from "./code-entry";

export default async function LoginPage() {
  if (await getPlayerId()) redirect("/quests");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-8">
      <section className="card w-full rounded-2xl p-6 md:p-10">
        <p className="label-caps mb-2">Welcome back</p>
        <h1 className="mb-6 text-4xl">Enter your code</h1>
        <CodeEntry />
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Meridian",
  description: "How Meridian handles the data you submit for analysis.",
};

export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href="/" className="mono text-sm tracking-[0.2em] text-muted transition hover:text-foreground">
        <span className="text-accent glow">⊕</span> MERIDIAN
      </Link>
      <h1 className="mt-8 text-4xl font-bold">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated June 2026.</p>
      <div className="mt-8 space-y-5 leading-relaxed text-muted">
        <p>
          <span className="font-medium text-foreground">What you submit.</span> When you run an analysis, the URL,
          GitHub repo, and/or description you provide are sent to third-party services to perform the review:
          LLM providers (Google Gemini, xAI Grok), and evidence tools (the GitHub API, a web-search API, and a
          headless-browser service for screenshots). Only submit material you&apos;re authorized to share.
        </p>
        <p>
          <span className="font-medium text-foreground">What we store.</span> Analysis runs and their results are
          stored in our database so reports persist. Any login credentials you optionally enter for a gated URL are
          used only for that single run and are <span className="text-foreground">never written to our database</span>.
        </p>
        <p>
          <span className="font-medium text-foreground">Analytics.</span> We use product analytics to understand how
          Meridian is used. We don&apos;t sell your data.
        </p>
        <p>
          <span className="font-medium text-foreground">No account required.</span> Meridian doesn&apos;t require
          sign-up and doesn&apos;t collect personal profiles.
        </p>
        <p>
          <span className="font-medium text-foreground">Contact.</span> Questions? Reach out via the project&apos;s
          GitHub repository.
        </p>
      </div>
      <Link
        href="/"
        className="pill mt-10 inline-block border border-border px-5 py-2.5 text-sm text-muted transition hover:text-foreground"
      >
        ← Back to Meridian
      </Link>
    </main>
  );
}

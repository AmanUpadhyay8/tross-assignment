'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import {
  Activity,
  ArrowRight,
  Braces,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldCheck,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_ORIGIN = 'http://localhost:3000';

const navItems: Array<[LucideIcon, string, boolean]> = [
  [TerminalSquare, 'Playground', true],
  [Activity, 'Health', false],
  [Braces, 'Response model', false],
  [ShieldCheck, 'Session safety', false],
];

const safetyItems: Array<[LucideIcon, string, string]> = [
  [CheckCircle2, 'Strict input', 'Only HTTPS linkedin.com/in/ profile URLs are accepted.'],
  [ShieldCheck, 'Safe failure', 'Login, checkpoint, CAPTCHA, and verification screens return a clear 503.'],
  [ExternalLink, 'Visible data only', 'The parser normalizes what the authenticated browser is allowed to render.'],
];

type Health = {
  ok?: boolean;
  browser?: string;
  linkedinSession?: string;
};

export default function Home() {
  const [url, setUrl] = useState('https://www.linkedin.com/in/example/');
  const [health, setHealth] = useState<Health | null>(null);
  const [result, setResult] = useState(
    JSON.stringify(
      {
        ready: true,
        next: 'Provision a private session, then submit a profile URL.',
      },
      null,
      2,
    ),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(API_ORIGIN + '/health')
      .then(async (response) => setHealth((await response.json()) as Health))
      .catch(() => setHealth(null));
  }, []);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(JSON.stringify({ status: 'extracting visible profile data…' }, null, 2));

    try {
      const response = await fetch(API_ORIGIN + '/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch {
      setResult(
        JSON.stringify(
          {
            error: {
              code: 'api_offline',
              message: 'Start the local API on port 3000, then try again.',
            },
          },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const apiOnline = Boolean(health?.ok);
  const sessionReady = health?.linkedinSession === 'configured';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[250px_1fr]">
        <aside className="border-b border-border/70 px-5 py-5 lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[10px] bg-primary font-mono text-sm font-bold text-primary-foreground">
                T/11
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">Tross Profile API</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  local console
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-border/80 bg-card/70 font-mono text-[10px] uppercase lg:mt-7"
            >
              v11 parser
            </Badge>
          </div>

          <nav aria-label="Console sections" className="mt-8 hidden space-y-1 lg:block">
            {navItems.map(([Icon, label, active]) => (
              <a
                key={String(label)}
                href={'#' + String(label).toLowerCase().replace(' ', '-')}
                className={
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ' +
                  (active
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                }
              >
                <Icon className="size-4" />
                {String(label)}
              </a>
            ))}
          </nav>

          <div className="mt-10 hidden rounded-xl border border-border/70 bg-card/50 p-4 lg:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              operating mode
            </p>
            <p className="mt-2 text-sm leading-6">
              Authenticated browser. Low concurrency. No challenge bypass.
            </p>
          </div>
        </aside>

        <section className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_70%_0%,color-mix(in_oklch,var(--primary)_24%,transparent),transparent_46%)]" />

          <header className="relative flex flex-col justify-between gap-6 border-b border-border/70 pb-8 sm:flex-row sm:items-end">
            <div>
              <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
                <span className="h-px w-8 bg-primary" />
                deterministic extraction service
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                Rendered profiles in.
                <br />
                Structured JSON out.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                A local, session-aware LinkedIn profile API built around the validated v11
                DOM parser. Optional fields stay honest: present, null, or empty—never invented.
              </p>
            </div>

            <div id="health" className="grid min-w-[220px] grid-cols-2 gap-2 font-mono text-[11px]">
              <Status label="API" ready={apiOnline} value={apiOnline ? 'online' : 'offline'} />
              <Status
                label="Session"
                ready={sessionReady}
                value={sessionReady ? 'configured' : 'required'}
              />
            </div>
          </header>

          <div className="relative mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)]">
            <Card
              id="playground"
              className="border border-border/80 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur"
            >
              <CardHeader className="border-b border-border/70 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl tracking-tight">Profile request</CardTitle>
                    <CardDescription className="mt-1">
                      POST a canonical LinkedIn profile URL to the local service.
                    </CardDescription>
                  </div>
                  <Badge className="bg-[#1e75ff] text-white">POST</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={submit}>
                  <label
                    htmlFor="profile-url"
                    className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    LinkedIn profile URL
                  </label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="profile-url"
                      type="url"
                      required
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      className="h-11 border-border bg-background/75 px-3 font-mono text-xs"
                      aria-describedby="url-help"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      disabled={loading}
                      className="h-11 bg-primary px-4 text-primary-foreground"
                    >
                      {loading ? <Clock3 className="animate-spin" /> : <ArrowRight />}
                      {loading ? 'Extracting' : 'Run request'}
                    </Button>
                  </div>
                  <p id="url-help" className="mt-2 text-xs text-muted-foreground">
                    Accepted: <code>https://www.linkedin.com/in/&lt;slug&gt;/</code>
                  </p>
                </form>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    ['16 KB', 'body limit'],
                    ['01', 'default concurrency'],
                    ['120 s', 'hard timeout'],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/70 bg-background/45 p-3"
                    >
                      <p className="font-mono text-lg text-primary">{value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card
              id="response-model"
              className="min-h-[440px] border border-[#263145] bg-[#090c12] text-[#f5f0e7] shadow-2xl shadow-black/20"
            >
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#ff735d]" />
                    <span className="size-2 rounded-full bg-[#efc45b]" />
                    <span className="size-2 rounded-full bg-[#5ac58e]" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                    response.json
                  </span>
                </div>
              </CardHeader>
              <CardContent className="relative flex-1 pt-5">
                <pre className="max-h-[390px] overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-[#c9d7ef]">
                  {result}
                </pre>
              </CardContent>
            </Card>
          </div>

          <div id="session-safety" className="relative mt-6 grid gap-4 md:grid-cols-3">
            {safetyItems.map(([Icon, title, copy]) => (
              <article
                key={String(title)}
                className="rounded-xl border border-border/70 bg-card/55 p-5"
              >
                <Icon className="size-5 text-primary" />
                <h2 className="mt-5 text-sm font-semibold">{String(title)}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{String(copy)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Status({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/75 p-3 backdrop-blur">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-foreground">
        <span className={'size-1.5 rounded-full ' + (ready ? 'bg-[#43c98b]' : 'bg-[#ff735d]')} />
        {value}
      </p>
    </div>
  );
}

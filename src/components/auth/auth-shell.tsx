import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell flex min-h-screen flex-col bg-[linear-gradient(135deg,#ebf5f0_0%,#f4f8f6_65%,#e6f0e7_100%)] p-5 sm:p-8 lg:p-10">
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
        <Link href="/login" aria-label="Folio home" className="flex items-baseline text-[32px] leading-none font-semibold tracking-[-1.8px] text-[#141414] dark:text-zinc-100">folio<span className="ml-0.5 text-[#96ac4a]">.</span></Link>
        <Link href="/preview" className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-xs font-medium text-[#4d5c53] transition hover:bg-white/60 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5">Explore the demo <span aria-hidden="true">&#8599;</span></Link>
      </header>

      <div className="mx-auto my-auto grid w-full max-w-[1100px] gap-8 py-10 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:py-14">
        <section className="relative hidden overflow-hidden rounded-[36px] border border-white/70 bg-[#dcebdc] dark:border-white/10 dark:bg-[#25362a] px-11 py-12 lg:flex lg:flex-col">
          <div className="absolute top-[-80px] right-[-80px] h-[330px] w-[330px] rounded-full bg-[#f4f4ab]/55 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="mb-5 text-[10px] font-medium tracking-[2px] text-[#6b7b68] dark:text-[#bdcdb8] uppercase">A little more peace of mind</p>
            <h2 className="max-w-[340px] text-[47px] leading-[1.1] font-medium tracking-[-2.2px] text-[#253c2e] dark:text-[#e4edde]">Your money.<br />A clearer picture.</h2>
            <p className="mt-5 max-w-[300px] text-sm leading-6 text-[#72836f] dark:text-[#bdcdb8]">Less keeping track. More moving forward. Everything you need, together in one place.</p>
          </div>

          <div className="relative mt-12 rounded-[28px] border border-white/75 bg-white/65 dark:border-white/10 dark:bg-[#1b271f] p-3 shadow-[0_20px_45px_rgba(46,67,39,0.07)]">
            <div className="rounded-[21px] bg-[#fef38b] p-6 text-[#141414]">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-sm">$</span> US Dollar</span>
                <span className="text-[9px] tracking-wider text-[#77713a] uppercase">Demo balance</span>
              </div>
              <p className="mt-6 text-[43px] leading-none font-semibold tracking-[-1.7px] tabular-nums">$26,887<span className="text-[30px] text-[#625f37]">.09</span></p>
              <div className="mt-4 flex items-center gap-2 text-[10px]"><span className="rounded-full bg-white/45 px-2 py-1 font-medium">&#8599; +$421.03</span><span className="text-[#7d773e]">this month</span></div>
            </div>
            <div className="flex items-center gap-3 px-3 pt-5 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dee9db] text-[#546d52]" aria-hidden="true">&#8600;</span>
              <div className="flex-1"><p className="text-xs font-medium text-[#343f34] dark:text-zinc-100">A little closer to your goals</p><p className="mt-1 text-[10px] text-[#879184] dark:text-zinc-400">One good habit at a time.</p></div>
              <span className="text-[#6e8468]" aria-hidden="true">&#10003;</span>
            </div>
          </div>

          <p className="relative mt-9 text-[11px] text-[#879580] dark:text-zinc-400">A calmer way to look after your finances.</p>
        </section>

        <section aria-label="Account access" className="flex items-center justify-center rounded-[32px] border border-white/80 bg-white/85 px-6 py-10 shadow-[0_20px_60px_rgba(36,55,43,0.025)] sm:px-10 lg:border-0 lg:bg-transparent lg:px-3 lg:shadow-none dark:border-white/10 dark:bg-[#1b231e] lg:dark:bg-transparent">
          {children}
        </section>
      </div>

      <footer className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 text-[10px] text-[#929b94]">
        <span>&copy; {new Date().getFullYear()} folio</span>
        <span>Make space for what matters.</span>
      </footer>
    </main>
  );
}

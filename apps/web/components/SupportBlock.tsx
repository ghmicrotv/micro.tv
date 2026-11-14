// «Поддержать развитие проекта»: a voluntary gift to the team via an external page (dalink.to).
// Wording follows the team's guidance: no «оплата / взнос / покупка / благотворительность»;
// card details are entered on the provider's page, never on this site.

export const SUPPORT_URL = "https://dalink.to/damicrotv";
export const FEEDBACK_URL = "https://forms.gle/rrQ9zgmg12vqEdZ7A";

const NOTE =
  "Перевод является безвозмездным дарением на развитие идеи и не предполагает предоставления платных услуг или доступа к контенту.";

export function SupportButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-12 items-center gap-2.5 rounded-btn bg-accent px-5 py-2.5 font-bold text-on-accent no-underline transition-colors hover:bg-accent-hover hover:text-on-accent ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
      <span>
        Поддержать развитие проекта
        <span className="block text-[13px] font-semibold opacity-80">добровольный подарок команде</span>
      </span>
    </a>
  );
}

/** Button + the required small-print note. */
export function SupportBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <SupportButton />
      <p className="max-w-[60ch] text-xs leading-relaxed text-muted">{NOTE}</p>
    </div>
  );
}

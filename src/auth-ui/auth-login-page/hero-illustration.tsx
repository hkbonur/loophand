/**
 * Login hero scene: a person at a desk reviewing an agent's task list; one
 * task fills in and gets approved (check badge). Monoline, single `currentColor`
 * stroke, surfaces on `var(--card)` — rounds-trips light/dark with no overrides.
 * Pure-CSS keyframes on a shared 9s story cycle; honours reduced-motion.
 */
export function HeroIllustration() {
  return (
    <div className="w-full max-w-md text-foreground">
      <style>{ILL_CSS}</style>
      <svg
        viewBox="0 0 620 460"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="A person at a desk reviewing an agent's task list; a task fills in and is approved."
        className="ill h-auto w-full"
      >
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Desk line */}
          <line x1="40" y1="395" x2="580" y2="395" />

          {/* Subject */}
          <g className="ill-person">
            <rect x="232" y="150" width="38" height="44" rx="15" />
            <circle cx="244" cy="174" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="259" cy="174" r="1.6" fill="currentColor" stroke="none" />
            <path d="M245 182q6 5 12 0" />
            <path d="M251 194v9" />
            <path d="M216 395C214 312 226 232 251 210c25 22 37 102 35 185" />
            <path d="M236 240q-22 36 6 92" />
            <path d="M266 240q22 36-6 92" />
          </g>

          {/* Device (in front of subject) */}
          <g>
            <path d="M218 330h66l12 42H206z" fill="currentColor" fillOpacity="0.92" />
            <circle cx="251" cy="351" r="3" fill="var(--background)" stroke="none" />
          </g>

          {/* Story cluster — task panel + connector + approval badge */}
          <g className="ill-cluster">
            {/* Panel */}
            <rect x="356" y="82" width="188" height="140" rx="10" fill="var(--card)" />
            <circle cx="370" cy="96" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="378" cy="96" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="386" cy="96" r="2.2" fill="currentColor" stroke="none" />

            {/* Task rows */}
            <rect x="372" y="112" width="156" height="26" rx="7" />
            <rect x="372" y="146" width="156" height="26" rx="7" />
            <rect x="372" y="180" width="156" height="26" rx="7" />

            {/* Row "text" that builds in */}
            <rect className="ill-line ill-line1" x="386" y="123" width="92" height="4" rx="2" fill="currentColor" fillOpacity="0.55" stroke="none" />
            <rect className="ill-line ill-line2" x="386" y="157" width="118" height="4" rx="2" fill="currentColor" fillOpacity="0.55" stroke="none" />
            <rect className="ill-line ill-line3" x="386" y="191" width="70" height="4" rx="2" fill="currentColor" fillOpacity="0.55" stroke="none" />

            {/* Connector + reveal mask */}
            <path d="M500 222q8 14 22 20" strokeDasharray="3 4" />
            <rect className="ill-conn-mask" x="494" y="214" width="44" height="34" fill="var(--background-accent)" stroke="none" />

            {/* Approval badge (payoff) */}
            <g className="ill-badge">
              <rect x="504" y="240" width="40" height="40" rx="9" fill="var(--card)" />
              <path className="ill-check" d="M516 260l5 5 11-12" strokeWidth="2" pathLength="26" strokeDasharray="26" strokeDashoffset="26" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

const ILL_CSS = `
.ill .ill-line { transform: scaleX(0); transform-box: fill-box; transform-origin: left center; }
.ill .ill-line1 { animation: ill-l1 9s linear infinite; }
.ill .ill-line2 { animation: ill-l2 9s linear infinite; }
.ill .ill-line3 { animation: ill-l3 9s linear infinite; }
.ill .ill-conn-mask { transform-box: fill-box; transform-origin: top center; animation: ill-conn 9s linear infinite; }
.ill .ill-badge { transform: scale(0); transform-box: fill-box; transform-origin: center; animation: ill-badge 9s cubic-bezier(0.4,1.5,0.6,1) infinite; }
.ill .ill-check { animation: ill-check 9s linear infinite; }
.ill .ill-cluster { transform-box: fill-box; animation: ill-float 6s ease-in-out infinite; }
.ill .ill-person { transform-box: fill-box; transform-origin: center bottom; animation: ill-breathe 3.8s ease-in-out infinite; }
@keyframes ill-l1 { 0%,3% { transform: scaleX(0); } 12%,95% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes ill-l2 { 0%,9% { transform: scaleX(0); } 18%,95% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes ill-l3 { 0%,15% { transform: scaleX(0); } 24%,95% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes ill-conn { 0%,30% { transform: scaleY(1); } 42%,95% { transform: scaleY(0); } 100% { transform: scaleY(1); } }
@keyframes ill-badge { 0%,40% { transform: scale(0); } 50%,95% { transform: scale(1); } 100% { transform: scale(0); } }
@keyframes ill-check { 0%,46% { stroke-dashoffset: 26; } 56%,95% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 26; } }
@keyframes ill-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes ill-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1px); } }
@media (prefers-reduced-motion: reduce) {
  .ill * { animation: none !important; }
  .ill .ill-line { transform: scaleX(1); }
  .ill .ill-conn-mask { transform: scaleY(0); }
  .ill .ill-badge { transform: scale(1); }
  .ill .ill-check { stroke-dashoffset: 0; }
}
`;

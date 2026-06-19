import { HeroIllustration } from "./hero-illustration";

export function HeroPanel() {
  return (
    <div className="hidden flex-col justify-between overflow-hidden border-r border-border bg-background-accent p-12 lg:flex lg:w-1/2">
      <div className="space-y-6">
        <p className="island-kicker">loophand</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          The human-in-the-loop board
          <br />
          <span className="text-muted-foreground">for your terminal agents.</span>
        </h1>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <HeroIllustration />
      </div>

      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} loophand. All rights reserved.
      </p>
    </div>
  );
}

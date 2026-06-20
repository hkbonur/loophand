import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, ClockIcon, TrashIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { nextSlot, isValidCron, isValidTimezone } from "../../convex/lib/cron";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Spinner } from "../ui/spinner";
import { Empty } from "../ui/empty";
import { toast } from "../ui/toaster";
import { nextRunLabel } from "./scheduleFormat";

const inputClass =
  "h-10 w-full rounded-full border border-border bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function SchedulesPanel() {
  const schedules = useQuery(api.schedules.list, {});
  const createSchedule = useMutation(api.schedules.create);
  const setEnabled = useMutation(api.schedules.setEnabled);
  const removeSchedule = useMutation(api.schedules.remove);

  const [name, setName] = React.useState("");
  const [cron, setCron] = React.useState("0 9 * * *");
  const [timezone, setTimezone] = React.useState(browserTimezone);
  const [title, setTitle] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [skipIfPrevOpen, setSkipIfPrevOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Live next-run preview (same cron engine the backend schedules with).
  const preview = React.useMemo(() => {
    if (!isValidCron(cron) || !isValidTimezone(timezone)) return null;
    try {
      return nextSlot(cron, timezone, now);
    } catch {
      return null;
    }
  }, [cron, timezone, now]);

  const canSave = title.trim() && instructions.trim() && preview !== null && !saving;

  const create = React.useCallback(async () => {
    setSaving(true);
    try {
      await createSchedule({
        name: name.trim() || title.trim(),
        cron,
        timezone,
        skipIfPrevOpen,
        taskTemplate: { type: "approval", title: title.trim(), instructions: instructions.trim() },
      });
      toast.success("Schedule created.");
      setName("");
      setTitle("");
      setInstructions("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the schedule.");
    } finally {
      setSaving(false);
    }
  }, [createSchedule, name, cron, timezone, skipIfPrevOpen, title, instructions]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to board
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-foreground">Schedules</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Recurring approval cards. One card is filed per cron slot, in your chosen timezone.
      </p>

      <section className="mb-8 flex flex-col gap-3 rounded-3xl border border-border bg-muted p-5">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Card title (e.g. Review nightly deploy)"
          className={inputClass}
        />
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="What should the human check each time?"
          className="min-h-20 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <input
            value={cron}
            onChange={(event) => setCron(event.target.value)}
            placeholder="cron e.g. 0 9 * * *"
            className={`${inputClass} flex-1 font-mono`}
          />
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="IANA timezone"
            className={`${inputClass} flex-1`}
          />
        </div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Schedule name (optional)"
          className={inputClass}
        />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={skipIfPrevOpen}
            onChange={(event) => setSkipIfPrevOpen(event.target.checked)}
          />
          Skip a run if the previous card is still unresolved
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {preview !== null ? `Next run ${nextRunLabel(preview, now)}` : "Enter a valid cron + timezone"}
          </span>
          <Button disabled={!canSave} onClick={create}>
            {saving ? <Spinner className="text-white" /> : <ClockIcon className="h-4 w-4" />}
            Create schedule
          </Button>
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Your schedules
      </h2>
      {schedules === undefined ? (
        <Spinner />
      ) : schedules.length === 0 ? (
        <Empty title="No schedules yet" description="Create one above to file recurring cards." />
      ) : (
        <ul className="flex flex-col gap-2">
          {schedules.map((schedule) => (
            <li
              key={schedule._id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{schedule.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {schedule.cron} · {schedule.timezone}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {schedule.enabled ? (
                  <Badge tone="success">{nextRunLabel(schedule.nextRunAt, now)}</Badge>
                ) : (
                  <Badge tone="neutral">Disabled</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEnabled({ id: schedule._id as Id<"schedules">, enabled: !schedule.enabled })
                  }
                >
                  {schedule.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSchedule({ id: schedule._id as Id<"schedules"> })}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

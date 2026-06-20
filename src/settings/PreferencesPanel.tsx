import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, SlidersIcon, TrashIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Empty } from "../ui/empty";
import { toast } from "../ui/toaster";
import { groupPreferences } from "./preferenceGroups";

const inputClass =
  "h-10 w-full rounded-full border border-border bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none";

// Scope sentinel for the user-level fallback (no project).
const USER_SCOPE = "user";

export function PreferencesPanel() {
  const prefs = useQuery(api.preferences.list, {});
  const projects = useQuery(api.projects.list, {});
  const setPreference = useMutation(api.preferences.set);
  const removePreference = useMutation(api.preferences.remove);

  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");
  const [scope, setScope] = React.useState<string>(USER_SCOPE);
  const [saving, setSaving] = React.useState(false);

  const canSave = key.trim().length > 0 && value.trim().length > 0 && !saving;

  const save = React.useCallback(async () => {
    setSaving(true);
    try {
      await setPreference({
        key,
        value,
        projectId: scope === USER_SCOPE ? undefined : (scope as Id<"projects">),
      });
      toast.success("Preference saved.");
      setKey("");
      setValue("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the preference.");
    } finally {
      setSaving(false);
    }
  }, [setPreference, key, value, scope]);

  const remove = (id: Id<"preferences">) => {
    void removePreference({ preferenceId: id }).catch(() =>
      toast.error("Could not remove the preference."),
    );
  };

  const groups =
    prefs && projects ? groupPreferences(prefs, projects) : undefined;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to board
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-foreground">Standing rules</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Key/value preferences an agent reads (via get_task) before asking you. A project rule
        overrides the all-projects fallback for the same key.
      </p>

      <section className="mb-8 flex flex-col gap-3 rounded-3xl border border-border bg-muted p-5">
        <div className="flex flex-wrap gap-2">
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Key (e.g. brand-color)"
            className={`${inputClass} flex-1`}
          />
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Value (e.g. #1d4ed8)"
            className={`${inputClass} flex-1`}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className={`${inputClass} flex-1`}
            aria-label="Scope"
          >
            <option value={USER_SCOPE}>All projects (fallback)</option>
            {(projects ?? []).map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          <Button disabled={!canSave} onClick={save}>
            {saving ? <Spinner className="text-white" /> : <SlidersIcon className="h-4 w-4" />}
            Save rule
          </Button>
        </div>
      </section>

      {groups === undefined ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Empty title="No standing rules yet" description="Add one above to cut a round-trip." />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.scope}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <li
                    key={entry._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-foreground">
                        {entry.key}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{entry.value}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => remove(entry._id)}>
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

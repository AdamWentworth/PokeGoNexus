import { useState, type FormEvent } from "react";
import { FaSave, FaTimes } from "react-icons/fa";
import OverlayDismissButton from "@/components/OverlayDismissButton";
import OverlayPortal from "@/components/OverlayPortal";
import type { RaidObservationActual } from "../utils/raidCalibration";

type RaidObservationDialogProps = {
  bossName: string;
  defaultTrainerCount: number;
  onCancel: () => void;
  onSave: (actual: RaidObservationActual) => void;
};

type ObservationForm = {
  outcome: RaidObservationActual["outcome"];
  trainerCount: string;
  clearTimeSeconds: string;
  faints: string;
  relobbies: string;
  dodgeAttempts: string;
  successfulDodges: string;
  latencyMs: string;
  remainingBossHpPercent: string;
};

const parseWholeNumber = (value: string): number =>
  Math.max(0, Math.floor(Number(value)));

const RaidObservationDialog = ({
  bossName,
  defaultTrainerCount,
  onCancel,
  onSave,
}: RaidObservationDialogProps) => {
  const [form, setForm] = useState<ObservationForm>({
    outcome: "cleared",
    trainerCount: String(Math.max(1, defaultTrainerCount)),
    clearTimeSeconds: "",
    faints: "0",
    relobbies: "0",
    dodgeAttempts: "0",
    successfulDodges: "0",
    latencyMs: "",
    remainingBossHpPercent: "",
  });
  const [error, setError] = useState("");

  const setField = (field: keyof ObservationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trainerCount = parseWholeNumber(form.trainerCount);
    const clearTimeSeconds = Number(form.clearTimeSeconds);
    const faints = parseWholeNumber(form.faints);
    const relobbies = parseWholeNumber(form.relobbies);
    const dodgeAttempts = parseWholeNumber(form.dodgeAttempts);
    const successfulDodges = parseWholeNumber(form.successfulDodges);
    const latencyMs = form.latencyMs.trim() ? Number(form.latencyMs) : null;
    const remainingBossHpPercent = form.remainingBossHpPercent.trim()
      ? Number(form.remainingBossHpPercent)
      : null;

    if (trainerCount < 1 || trainerCount > 20) {
      setError("Trainer count must be between 1 and 20.");
      return;
    }
    if (
      !Number.isFinite(clearTimeSeconds) ||
      clearTimeSeconds <= 0 ||
      clearTimeSeconds > 1800
    ) {
      setError("Battle time must be between 1 and 1800 seconds.");
      return;
    }
    if (successfulDodges > dodgeAttempts) {
      setError("Successful dodges cannot exceed attempted dodges.");
      return;
    }
    if (
      latencyMs != null &&
      (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 5000)
    ) {
      setError("Latency must be between 0 and 5000 ms.");
      return;
    }
    if (
      remainingBossHpPercent != null &&
      (!Number.isFinite(remainingBossHpPercent) ||
        remainingBossHpPercent < 0 ||
        remainingBossHpPercent > 100)
    ) {
      setError("Remaining boss HP must be between 0 and 100%.");
      return;
    }

    onSave({
      outcome: form.outcome,
      trainerCount,
      clearTimeSeconds,
      remainingBossHpPercent:
        form.outcome === "timed-out" ? remainingBossHpPercent : null,
      faints,
      relobbies,
      dodgeAttempts,
      successfulDodges,
      latencyMs,
    });
  };

  return (
    <OverlayPortal onClose={onCancel} closeOnBackdrop>
      <div className="raid-observation-overlay">
      <form
        aria-label={`Log ${bossName} raid`}
        aria-modal="true"
        className="raid-observation-dialog"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <header>
          <div>
            <span>Observed battle</span>
            <h2>{bossName}</h2>
          </div>
          <OverlayDismissButton aria-label="Close raid log" onDismiss={onCancel}>
            <FaTimes aria-hidden="true" />
          </OverlayDismissButton>
        </header>

        <div className="raid-observation-outcome" aria-label="Raid outcome">
          <button
            className={form.outcome === "cleared" ? "active" : ""}
            onClick={() => setField("outcome", "cleared")}
            type="button"
          >
            Cleared
          </button>
          <button
            className={form.outcome === "timed-out" ? "active" : ""}
            onClick={() => setField("outcome", "timed-out")}
            type="button"
          >
            Timed out
          </button>
        </div>

        <div className="raid-observation-fields">
          <label>
            <span>Trainers</span>
            <input
              inputMode="numeric"
              max="20"
              min="1"
              onChange={(event) => setField("trainerCount", event.target.value)}
              required
              type="number"
              value={form.trainerCount}
            />
          </label>
          <label>
            <span>Battle time (seconds)</span>
            <input
              inputMode="decimal"
              max="1800"
              min="1"
              onChange={(event) =>
                setField("clearTimeSeconds", event.target.value)
              }
              required
              step="0.1"
              type="number"
              value={form.clearTimeSeconds}
            />
          </label>
          {form.outcome === "timed-out" && (
            <label>
              <span>Boss HP left % (optional)</span>
              <input
                inputMode="decimal"
                max="100"
                min="0"
                onChange={(event) =>
                  setField("remainingBossHpPercent", event.target.value)
                }
                step="0.1"
                type="number"
                value={form.remainingBossHpPercent}
              />
            </label>
          )}
          <label>
            <span>Faints</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) => setField("faints", event.target.value)}
              required
              type="number"
              value={form.faints}
            />
          </label>
          <label>
            <span>Relobbies</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) => setField("relobbies", event.target.value)}
              required
              type="number"
              value={form.relobbies}
            />
          </label>
          <label>
            <span>Dodges attempted</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) =>
                setField("dodgeAttempts", event.target.value)
              }
              required
              type="number"
              value={form.dodgeAttempts}
            />
          </label>
          <label>
            <span>Dodges successful</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) =>
                setField("successfulDodges", event.target.value)
              }
              required
              type="number"
              value={form.successfulDodges}
            />
          </label>
          <label className="raid-observation-latency">
            <span>Measured latency (ms, optional)</span>
            <input
              inputMode="numeric"
              max="5000"
              min="0"
              onChange={(event) => setField("latencyMs", event.target.value)}
              type="number"
              value={form.latencyMs}
            />
          </label>
        </div>

        {error && <p className="raid-observation-error">{error}</p>}

        <footer>
          <span>Saved only on this device</span>
          <button className="raid-observation-save" type="submit">
            <FaSave aria-hidden="true" />
            <span>Save result</span>
          </button>
        </footer>
      </form>
      </div>
    </OverlayPortal>
  );
};

export default RaidObservationDialog;

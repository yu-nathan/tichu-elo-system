import { Input } from "@/components/ui/input";
import type { Player } from "@/lib/models";

type FieldProps = {
  label: string;
  type: string;
  value: string | number;
  min?: number;
  onChange: (value: string) => void;
};

export const Field = ({ label, type, value, min, onChange }: FieldProps) => (
  <label className="flex min-w-0 flex-col gap-1.5 text-sm">
    <span className="flex-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
    <Input
      required
      type={type === "number" ? "text" : type}
      inputMode={type === "number" ? "numeric" : undefined}
      pattern={
        type === "number" ? (min === 0 ? "[0-9]+" : "-?[0-9]+") : undefined
      }
      title={
        type === "number"
          ? min === 0
            ? "Enter a nonnegative whole number."
            : "Enter a whole number; negative scores are allowed."
          : undefined
      }
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

type PlayerSelectProps = {
  label: string;
  value: number;
  players: Player[];
  onChange: (value: number) => void;
};

export const PlayerSelect = ({
  label,
  value,
  players,
  onChange,
}: PlayerSelectProps) => (
  <label className="flex min-w-0 flex-col gap-1.5 text-sm">
    <span className="flex-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
    <select
      className="h-9 w-full rounded-lg border border-input bg-input/30 px-2 text-sm"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {players.map((player) => (
        <option
          key={player.id}
          value={player.id}
          disabled={Boolean(player.archivedAt)}
        >
          {player.code} · {player.name}
          {player.archivedAt ? " (archived)" : ""}
        </option>
      ))}
    </select>
  </label>
);

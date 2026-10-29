import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatTicketInput, parseTicketCents } from "@/lib/invasao-finance";

export function InvasaoTicketInput({
  cents,
  label,
  disabled,
  onChange,
}: {
  cents: number | null;
  label: string;
  disabled?: boolean;
  onChange: (cents: number | null) => void;
}) {
  const [text, setText] = useState(() => formatTicketInput(cents));
  const [focused, setFocused] = useState(false);
  const invalid = parseTicketCents(text).invalid;
  useEffect(() => {
    if (!focused && !invalid) setText(formatTicketInput(cents));
  }, [cents, focused, invalid]);
  return (
    <div className="ml-auto w-28">
      <Input
        aria-label={label}
        aria-invalid={invalid || undefined}
        type="text"
        inputMode="decimal"
        placeholder="Informar"
        value={text}
        disabled={disabled}
        className="h-9 text-right tabular-nums"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setText(event.target.value);
          // Texto inválido não grava nada: o último valor válido continua salvo.
          const parsed = parseTicketCents(event.target.value);
          if (!parsed.invalid) onChange(parsed.cents);
        }}
      />
      {invalid && (
        <p className="mt-1 text-xs text-destructive">
          Use zero ou um valor positivo com até 2 casas decimais.
        </p>
      )}
    </div>
  );
}

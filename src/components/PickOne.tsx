// Big buttons that are radio buttons underneath (styles: .gender-pick):
// male, female or T-Rex, and who a meetup is for. Plain radios, so the
// form sends the answer by itself and a keyboard moves through them with
// the arrow keys.

export type PickOption = { value: string; emoji: string; label: string };

export default function PickOne({
  name,
  options,
  defaultValue,
  required = false,
  onPick,
}: {
  name: string;
  options: PickOption[];
  defaultValue?: string | null;
  required?: boolean;
  onPick?: (value: string) => void;
}) {
  return (
    <div className={`grid gap-2 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((o) => (
        <label key={o.value} className="gender-pick">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={o.value === defaultValue}
            required={required}
            onChange={onPick ? () => onPick(o.value) : undefined}
            className="sr-only"
          />
          <span className="gender-pick-emoji" aria-hidden="true">
            {o.emoji}
          </span>
          {o.label}
        </label>
      ))}
    </div>
  );
}

// ₦ at 0.85em so it never visually overhangs the digits beside it.
export function NairaSign({ className }: { className?: string }) {
  return (
    <span style={{ fontSize: "0.85em", lineHeight: 1 }} className={className}>
      ₦
    </span>
  );
}

// Renders a formatted currency string (e.g. "₦1,234.56") with the naira sign
// optically matched to the digits — all in font-sans.
export function Amt({ value }: { value: string }) {
  if (value.startsWith("₦")) {
    return (
      <span className="font-sans">
        <NairaSign />
        {value.slice(1)}
      </span>
    );
  }
  return <span className="font-sans">{value}</span>;
}

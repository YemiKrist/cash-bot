// Renders a formatted currency string so ₦ uses font-sans and digits use
// font-mono, preventing the naira symbol from rendering oversized due to
// monospace font fallback.
export function Amt({ value }: { value: string }) {
  const idx = value.indexOf("₦");
  if (idx === -1) return <span className="font-mono">{value}</span>;
  return (
    <>
      {idx > 0 && <span className="font-mono">{value.slice(0, idx)}</span>}
      <span className="font-sans">₦</span>
      <span className="font-mono">{value.slice(idx + 1)}</span>
    </>
  );
}

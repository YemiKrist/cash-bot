// Renders a currency string entirely in font-mono so ₦ and digits share
// the same metrics and render at identical optical size.
export function Amt({ value }: { value: string }) {
  return <span className="font-mono">{value}</span>;
}

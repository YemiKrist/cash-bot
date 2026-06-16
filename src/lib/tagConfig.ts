export const TAG_COLORS: Record<string, string> = {
  revenue:         "bg-emerald-900/50 text-emerald-400",
  cogs:            "bg-amber-900/50 text-amber-400",
  opex:            "bg-blue-900/50 text-blue-400",
  fixed_cost:      "bg-sky-900/50 text-sky-400",
  capex:           "bg-indigo-900/50 text-indigo-400",
  food_groceries:  "bg-orange-900/50 text-orange-400",
  transport:       "bg-cyan-900/50 text-cyan-400",
  bills_utilities: "bg-violet-900/50 text-violet-400",
  personal_luxury: "bg-pink-900/50 text-pink-400",
  clothing:        "bg-rose-900/50 text-rose-400",
  investment:      "bg-teal-900/50 text-teal-400",
  family_gifting:  "bg-purple-900/50 text-purple-400",
  salary_income:   "bg-emerald-900/50 text-emerald-400",
  gifts_received:  "bg-green-900/50 text-green-400",
};

export function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    revenue:         "Revenue",
    cogs:            "COGS",
    opex:            "OPEX",
    fixed_cost:      "Fixed Cost",
    capex:           "CapEx",
    food_groceries:  "Food",
    transport:       "Transport",
    bills_utilities: "Bills",
    personal_luxury: "Luxury",
    clothing:        "Clothing",
    investment:      "Savings",
    family_gifting:  "Family",
    salary_income:   "Salary",
    gifts_received:  "Gifts",
  };
  return map[tag] ?? tag;
}

export const BIZ_PALETTE = [
  "bg-violet-600", "bg-blue-600", "bg-emerald-600", "bg-amber-500",
  "bg-rose-600",   "bg-cyan-600", "bg-orange-500",  "bg-indigo-600",
];

export function bizInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function bizColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BIZ_PALETTE[h % BIZ_PALETTE.length];
}

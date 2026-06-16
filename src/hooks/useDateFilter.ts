"use client";

import { useState } from "react";
import type { Transaction } from "@/lib/types";

export type DatePreset = "day" | "week" | "month" | "year" | "custom";

function monthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0);
}
function monthEnd() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function useDateFilter(transactions: Transaction[]) {
  const [activePreset, setActivePreset] = useState<DatePreset>("month");
  const [startDate, setStartDate] = useState<Date>(monthStart);
  const [endDate, setEndDate] = useState<Date>(monthEnd);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  function applyPreset(preset: Exclude<DatePreset, "custom">) {
    const n = new Date();
    const [y, m, d] = [n.getFullYear(), n.getMonth(), n.getDate()];
    let s: Date, e: Date;
    if (preset === "day") {
      s = new Date(y, m, d, 0, 0, 0, 0);
      e = new Date(y, m, d, 23, 59, 59, 999);
    } else if (preset === "week") {
      const dow = n.getDay();
      s = new Date(y, m, d - dow, 0, 0, 0, 0);
      e = new Date(y, m, d + (6 - dow), 23, 59, 59, 999);
    } else if (preset === "month") {
      s = new Date(y, m, 1, 0, 0, 0, 0);
      e = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } else {
      s = new Date(y, 0, 1, 0, 0, 0, 0);
      e = new Date(y, 11, 31, 23, 59, 59, 999);
    }
    setStartDate(s); setEndDate(e); setActivePreset(preset);
  }

  function reset() {
    setSearchQuery(""); setActivePreset("month"); setCustomStart(""); setCustomEnd("");
    setStartDate(monthStart()); setEndDate(monthEnd());
  }

  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || tx.description?.toLowerCase().includes(q) ||
      tx.financial_tag?.toLowerCase().includes(q) || tx.amount?.toString().includes(q);
    const txDate = new Date(tx.created_at);
    return matchesSearch && txDate >= startDate && txDate <= endDate;
  });

  return {
    activePreset, startDate, endDate, customStart, customEnd, searchQuery,
    setSearchQuery, setActivePreset, setStartDate, setEndDate, setCustomStart, setCustomEnd,
    applyPreset, reset, filteredTransactions,
  };
}

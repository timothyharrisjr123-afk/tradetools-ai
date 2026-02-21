export interface RoofingEstimate {
  id: string;
  createdAt: string;
  customerName: string;
  address: string;
  zip: string;
  roofAreaSqFt: number;
  selectedTier: "Core" | "Enhanced" | "Premium";
  suggestedPrice: number;
}

const STORAGE_KEY = "roofing_estimates";

export function saveEstimate(data: RoofingEstimate) {
  if (typeof window === "undefined") return;
  const existing = getEstimates();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([data, ...existing])
  );
}

export function getEstimates(): RoofingEstimate[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function deleteEstimate(id: string) {
  if (typeof window === "undefined") return;
  const filtered = getEstimates().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

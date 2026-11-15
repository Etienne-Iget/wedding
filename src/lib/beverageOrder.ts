import type { Beverage, Guest } from '@/types';

export const DRINKS_PER_GUEST = 3;

export interface BeverageOrderLine {
  beverage: Beverage;
  quantity: number;
  toOrder: number;
}

export function beverageOrderLines(beverages: Beverage[], guests: Guest[]): BeverageOrderLine[] {
  const totals = new Map<string, number>();
  for (const g of guests) {
    if (!g.beverageId) continue;
    totals.set(g.beverageId, (totals.get(g.beverageId) ?? 0) + (g.beverageQuantity ?? 1));
  }
  return beverages
    .filter((b) => (totals.get(b.id) ?? 0) > 0)
    .map((b) => {
      const quantity = totals.get(b.id) ?? 0;
      return { beverage: b, quantity, toOrder: quantity * (b.stock ?? 0) };
    })
    .sort((a, b) => a.beverage.name.localeCompare(b.beverage.name));
}

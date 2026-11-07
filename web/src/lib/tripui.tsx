import { createContext, useContext } from "react";
import type { Item, ItemType } from "@tmt/shared";

export type ColorBy = "day" | "type";
export interface TripUI {
  selectedId: string | null; setSelectedId: (id: string | null) => void;
  hoverId: string | null; setHoverId: (id: string | null) => void;
  dayFilter: string | null; setDayFilter: (d: string | null) => void;
  typeFilter: Set<ItemType>; toggleType: (t: ItemType) => void;
  colorBy: ColorBy; setColorBy: (c: ColorBy) => void;
  openEditor: (target: Item | { type: ItemType; date?: string }) => void;
  readOnly: boolean;
  showConfirmations: boolean;
  showCosts: boolean;
  dayColor: (date: string) => string;
  dayIndex: (date: string) => number;
  flyTo: (lng: number, lat: number) => void;
  registerFlyTo: (fn: (lng: number, lat: number) => void) => void;
}
export const TripUIContext = createContext<TripUI | null>(null);
export const useTripUI = () => { const c = useContext(TripUIContext); if (!c) throw new Error("TripUI missing"); return c; };

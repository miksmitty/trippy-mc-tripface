import { Fragment, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { bucketByDay, TYPE_META, type TripDetail } from "@tmt/shared";
import { fmtDayLong } from "../lib/time";
import { useTripUI } from "../lib/tripui";
import { ItemCard } from "./cards/ItemCard";

export function Timeline({ trip }: { trip: TripDetail }) {
  const ui = useTripUI();
  const days = bucketByDay(trip.items, trip.startDate, trip.endDate);
  const visible = ui.dayFilter ? days.filter((d) => d.date === ui.dayFilter) : days;
  const selRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ui.selectedId) selRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [ui.selectedId]);
  const today = new Date().toISOString().slice(0, 10);

  if (!trip.items.length && !visible.length) return <div className="p-10 text-center text-ink-3">Nothing planned yet. Add a flight or ask your agent.</div>;

  return (
    <div className="pb-24">
      {visible.map((d) => {
        const items = d.items.filter((i) => ui.typeFilter.size === 0 || ui.typeFilter.has(i.type));
        const idx = ui.dayIndex(d.date);
        const color = ui.dayColor(d.date);
        return (
          <section key={d.date} id={`day-${d.date}`} className="relative">
            <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur border-b border-line px-5 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-paper-2/70" onClick={() => ui.setDayFilter(ui.dayFilter === d.date ? null : d.date)} title="Click to focus this day">
              <span className="w-7 h-7 rounded-lg grid place-items-center text-white text-xs font-bold shrink-0" style={{ background: color }}>{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-[15px] leading-tight flex items-center gap-2">{fmtDayLong(d.date)}{d.date === today && <span className="chip bg-amber-100 border-amber-200 text-amber-800">today</span>}</div>
                {d.stays.length > 0 && <div className="text-[11.5px] text-ink-2 truncate">🛏️ {d.stays.map((s) => s.title).join(" · ")}</div>}
              </div>
              {!ui.readOnly && <button className="btn-ghost -mr-2 px-2" onClick={(e) => { e.stopPropagation(); ui.openEditor({ type: "activity", date: d.date }); }} title="Add to this day"><Plus size={16} /></button>}
            </header>
            <div className="px-4 py-3 space-y-2.5">
              {items.length === 0 && <div className="text-[13px] text-ink-3 px-2 py-1.5 italic">Free day{!ui.readOnly && " — add something or ask your agent for ideas"}</div>}
              {items.map((it) => (
                <Fragment key={it.id}>
                  <div ref={it.id === ui.selectedId ? selRef : undefined}>
                    <ItemCard item={it} accent={ui.colorBy === "day" ? color : TYPE_META[it.type].color} />
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

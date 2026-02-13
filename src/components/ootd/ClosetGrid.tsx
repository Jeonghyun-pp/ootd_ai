"use client";

import { useState } from "react";
import { Shirt } from "lucide-react";
import { type ClosetItem } from "@/lib/mock/closet";
import ClosetItemCard from "./ClosetItemCard";
import ClosetItemDialog from "./ClosetItemDialog";

interface ClosetGridProps {
  items: ClosetItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ClosetGrid({
  items,
  selectedId,
  onSelect,
}: ClosetGridProps) {
  const [dialogItem, setDialogItem] = useState<ClosetItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleClick(item: ClosetItem) {
    onSelect(item.id);
    setDialogItem(item);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-50/50 to-blue-50/30 p-3 border border-border/30">
        <div className="rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 p-1.5 border border-border/30">
          <Shirt className="size-4 text-blue-600" />
        </div>
        <h3 className="text-sm font-semibold text-foreground/80">
          @geonu 의 옷장
        </h3>
        <span className="text-xs text-muted-foreground bg-white/60 rounded-md px-2 py-0.5 border border-border/30">
          {items.length}벌
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <ClosetItemCard
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onClick={() => handleClick(item)}
          />
        ))}
      </div>

      <ClosetItemDialog
        item={dialogItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

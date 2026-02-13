"use client";

import { mockClosetItems, type ClosetItem } from "@/lib/mock/closet";
import ClosetItemCard from "@/components/ootd/ClosetItemCard";
import ClosetItemDialog from "@/components/ootd/ClosetItemDialog";
import { useState } from "react";

export default function GallerySection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogItem, setDialogItem] = useState<ClosetItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Show first 9 items for gallery
  const galleryItems = mockClosetItems.slice(0, 9);

  function handleClick(item: ClosetItem) {
    setSelectedId(item.id);
    setDialogItem(item);
    setDialogOpen(true);
  }

  return (
    <section
      id="gallery"
      className="py-24 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            인기 코디 갤러리
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            다른 사용자들이 만든 스타일을 둘러보고 영감을 얻어보세요
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {galleryItems.map((item) => (
            <ClosetItemCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onClick={() => handleClick(item)}
            />
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="text-primary font-semibold hover:underline transition-colors">
            더 많은 코디 보기 →
          </button>
        </div>
      </div>

      <ClosetItemDialog
        item={dialogItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </section>
  );
}

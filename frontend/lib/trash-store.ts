"use client";

import { useEffect, useState } from "react";
import { deleteDocument } from "./api";

export interface TrashItem {
  id: string;
  filename: string;
  collection: string;
  source_type: string;
  chunk_count?: number;
  page_count?: number;
  deleted_at: string;
}

const STORAGE_KEY = "titan_workstation_trash_items";

export function getTrashItems(): TrashItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTrashItems(items: TrashItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("titan:trash-changed", { detail: items }));
  } catch (e) {
    console.error("Failed to save trash:", e);
  }
}

export function moveToTrash(item: Omit<TrashItem, "deleted_at">): void {
  const current = getTrashItems();
  // Avoid duplicate entries
  const filtered = current.filter((x) => x.id !== item.id);
  const newItem: TrashItem = {
    ...item,
    deleted_at: new Date().toISOString(),
  };
  const updated = [newItem, ...filtered];
  saveTrashItems(updated);
}

export function restoreFromTrash(id: string): TrashItem | null {
  const current = getTrashItems();
  const found = current.find((x) => x.id === id);
  if (found) {
    saveTrashItems(current.filter((x) => x.id !== id));
    window.dispatchEvent(new CustomEvent("titan:document-restored", { detail: found }));
  }
  return found || null;
}

export async function permanentDeleteFromTrash(id: string): Promise<void> {
  const current = getTrashItems();
  try {
    // Call the actual Titan backend deletion API
    await deleteDocument(id);
  } catch (err) {
    console.warn("Backend permanent delete error (item may already be deleted from db):", err);
  }
  saveTrashItems(current.filter((x) => x.id !== id));
}

export async function emptyAllTrash(): Promise<void> {
  const current = getTrashItems();
  for (const item of current) {
    try {
      await deleteDocument(item.id);
    } catch (e) {
      console.warn("Failed deleting item during empty trash:", item.id, e);
    }
  }
  saveTrashItems([]);
}

export function useTrash() {
  const [trash, setTrash] = useState<TrashItem[]>([]);

  useEffect(() => {
    setTrash(getTrashItems());

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<TrashItem[]>;
      if (customEvent.detail) {
        setTrash(customEvent.detail);
      } else {
        setTrash(getTrashItems());
      }
    };

    window.addEventListener("titan:trash-changed", handler);
    return () => window.removeEventListener("titan:trash-changed", handler);
  }, []);

  return {
    trash,
    trashCount: trash.length,
    moveToTrash,
    restoreFromTrash,
    permanentDeleteFromTrash,
    emptyAllTrash,
  };
}

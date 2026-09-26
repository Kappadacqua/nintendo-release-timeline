import type { Change, ChangesFile } from "./types";

/**
 * What's new (ITERATION-3 §4): the changes from changes.json and which of them
 * this browser has already seen. Shared by cards, minimap and the header panel.
 */
const STORAGE_KEY = "whats-new";
/** On a first visit only the last week counts as new. */
const FIRST_VISIT_DAYS = 7;

export const NEWS_LABEL: Record<Change["type"], string> = { new: "New", delayed: "Delayed", "reviews-in": "Reviews in" };

const keyOf = (c: Change) => `${c.date}|${c.type}|${c.id}`;

class News {
  /** Newest first. */
  changes: Change[] = [];
  private seen = new Set<string>();
  private readonly listeners = new Set<() => void>();

  load(file: ChangesFile, today: string) {
    this.changes = file.changes;
    let stored: string[] | null = null;
    try {
      stored = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { seen: string[] } | null)?.seen ?? null;
    } catch {
      // Storage unavailable: treated as a first visit.
    }
    if (stored) {
      this.seen = new Set(stored);
    } else {
      const since = new Date(Date.parse(today) - FIRST_VISIT_DAYS * 86_400_000).toISOString().slice(0, 10);
      this.seen = new Set(this.changes.filter((c) => c.date < since).map(keyOf));
    }
    this.save();
  }

  isSeen(c: Change) {
    return this.seen.has(keyOf(c));
  }

  unseen() {
    return this.changes.filter((c) => !this.isSeen(c));
  }

  /** The newest unseen change of a game, for its "!" badge and minimap dot. */
  unseenFor(gameId: string) {
    return this.changes.find((c) => c.id === gameId && !this.isSeen(c)) ?? null;
  }

  /** Selecting a card sees all of its changes. */
  markSeen(gameId: string) {
    this.mark(this.changes.filter((c) => c.id === gameId));
  }

  markAllSeen() {
    this.mark(this.changes);
  }

  onChange(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private mark(changes: Change[]) {
    const fresh = changes.filter((c) => !this.isSeen(c));
    if (!fresh.length) return;
    for (const c of fresh) this.seen.add(keyOf(c));
    this.save();
    for (const listener of this.listeners) listener();
  }

  private save() {
    // Only keys still in changes.json: older ones can never come back.
    const current = new Set(this.changes.map(keyOf));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: [...this.seen].filter((k) => current.has(k)) }));
    } catch {
      // Storage unavailable: seen for this visit only.
    }
  }
}

export const news = new News();

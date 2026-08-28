import { readDataSnapshot, type DataSnapshotKind } from "@/lib/database.server";
import { EMPTY_SNAPSHOTS, type SnapshotKindMap } from "@/lib/snapshot-types";

export type SnapshotFor<K extends DataSnapshotKind> = SnapshotKindMap[K];

export function getDataSnapshot<K extends DataSnapshotKind>(kind: K): SnapshotFor<K> {
  const stored = readDataSnapshot<SnapshotFor<K>>(kind);
  if (stored) return stored;
  return EMPTY_SNAPSHOTS[kind] as SnapshotFor<K>;
}

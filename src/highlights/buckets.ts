export type BucketId = "needs-reference" | "reword" | "todo" | "question" | "unclear";

export interface Bucket {
  id: BucketId;
  label: string;
}

export const BUCKETS: readonly Bucket[] = [
  { id: "needs-reference", label: "Needs reference" },
  { id: "reword", label: "Reword" },
  { id: "todo", label: "To do" },
  { id: "question", label: "Question" },
  { id: "unclear", label: "Unclear" },
];

export function bucketLabel(id: BucketId): string {
  return BUCKETS.find((bucket) => bucket.id === id)?.label ?? id;
}

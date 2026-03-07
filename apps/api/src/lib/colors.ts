/** Cluster map palette; shared with worker so zone-derived clusters match. */
const PALETTE = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C', '#3498DB', '#9B59B6', '#34495E',
  '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#2C3E50', '#C0392B', '#D35400'
];

export function pickClusterColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

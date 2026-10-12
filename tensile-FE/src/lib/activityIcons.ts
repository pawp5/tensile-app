/* Icon paths for activity rows (24x24, stroked), keyed by ActivityItem.kind. From the Overview design. */
export const ACTIVITY_ICON: Record<string, string> = {
  mint: 'M6 3h9l4 4v14H6zM14 3v5h5M9 14l2 2 4-4',
  insp: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8',
  loan: 'M12 4v16M8 20h8M4 8h16M6 8l-3 6h6zM18 8l-3 6h6z',
  repay: 'M4 12a8 8 0 1016 0 8 8 0 10-16 0M9 12l2 2 4-4',
  trade: 'M4 8h15l-3-3M20 16H5l3 3',
  transfer: 'M4 8h15l-3-3M20 16H5l3 3',
  redeem: 'M2 7h11v9H2zM13 10h5l3 3v3h-8',
  identity: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  role: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  warehouse: 'M3 10l9-6 9 6v10H3zM7 20v-7h10v7M7 16h10',
  vault: 'M3 5h18v14H3zM12 9a3 3 0 100 6 3 3 0 100-6z',
};

export const activityIcon = (kind: string) => ACTIVITY_ICON[kind] ?? ACTIVITY_ICON.mint;

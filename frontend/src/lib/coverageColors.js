// Maps Claude coverage_status + color field to display properties
export const COVERAGE_COLORS = {
  green:  { hex: '#22c55e', label: 'Covered',        opacity: 0.4 },
  red:    { hex: '#ef4444', label: 'Excluded',       opacity: 0.5 },
  amber:  { hex: '#f59e0b', label: 'Partial',        opacity: 0.4 },
  gray:   { hex: '#6b7280', label: 'Pending Review', opacity: 0.3 },
};

export function getColor(colorKey) {
  return COVERAGE_COLORS[colorKey] || COVERAGE_COLORS.gray;
}

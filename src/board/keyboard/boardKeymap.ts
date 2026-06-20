// Pure keyboard-navigation logic for the board. The wiring (focus state, DOM
// listener, focus ring) lives in BoardPage; this owns the key→command mapping
// and the focus arithmetic so both are unit-testable without a DOM.

export type NavCommand = "up" | "down" | "left" | "right" | "open" | null;

export interface Focus {
  col: number;
  row: number;
}

// Vim keys + arrows for movement; Enter/o to open the focused card.
export function keyToNavCommand(key: string): NavCommand {
  switch (key) {
    case "j":
    case "ArrowDown":
      return "down";
    case "k":
    case "ArrowUp":
      return "up";
    case "h":
    case "ArrowLeft":
      return "left";
    case "l":
    case "ArrowRight":
      return "right";
    case "o":
    case "Enter":
      return "open";
    default:
      return null;
  }
}

function nearestNonEmpty(columns: number[], from: number, step: -1 | 1): number | null {
  for (let col = from + step; col >= 0 && col < columns.length; col += step) {
    if (columns[col] > 0) return col;
  }
  return null;
}

function firstNonEmpty(columns: number[]): number | null {
  const col = columns.findIndex((len) => len > 0);
  return col === -1 ? null : col;
}

// Move focus over `columns` (each entry = that column's card count), clamping at
// edges and skipping empty columns horizontally. A directional command from no
// focus lands on the first card of the first non-empty column. Returns null only
// when the board has no cards at all.
export function moveFocus(columns: number[], focus: Focus | null, command: NavCommand): Focus | null {
  if (command === null || command === "open") return focus;

  if (focus === null) {
    const col = firstNonEmpty(columns);
    return col === null ? null : { col, row: 0 };
  }

  const colLen = columns[focus.col] ?? 0;
  if (command === "down") return { col: focus.col, row: Math.min(focus.row + 1, colLen - 1) };
  if (command === "up") return { col: focus.col, row: Math.max(focus.row - 1, 0) };

  const step = command === "left" ? -1 : 1;
  const nextCol = nearestNonEmpty(columns, focus.col, step);
  if (nextCol === null) return focus;
  return { col: nextCol, row: Math.min(focus.row, columns[nextCol] - 1) };
}

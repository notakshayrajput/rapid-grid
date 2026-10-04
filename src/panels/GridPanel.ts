export type PanelKind = 'cells' | 'columnHeaders' | 'rowHeaders' | 'topLeftCells';
export class GridPanel {
  constructor(readonly kind: PanelKind, readonly hostElement: HTMLElement) {}
}

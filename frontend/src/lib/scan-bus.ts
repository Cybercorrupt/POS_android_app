// Tiny one-shot bus to hand a scanned barcode from the scanner screen back to
// whichever screen opened it for text search (products list / POS search).

let pending: string | null = null;

export const scanBus = {
  set(code: string) {
    pending = code;
  },
  take(): string | null {
    const c = pending;
    pending = null;
    return c;
  },
};

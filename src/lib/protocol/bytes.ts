// Little-endian 16-bit values, as the pedal sends and expects its numbers.

/** The first `n` u16 values of `b`. */
export const u16s = (b: Uint8Array, n: number) => Array.from({ length: n }, (_, i) => b[2 * i] | (b[2 * i + 1] << 8));

/** `vals` as u16 values, two bytes each. */
export const packU16 = (...vals: number[]) => {
  const b = new Uint8Array(vals.length * 2);
  vals.forEach((v, i) => {
    b[2 * i] = v & 0xff;
    b[2 * i + 1] = (v >> 8) & 0xff;
  });
  return b;
};

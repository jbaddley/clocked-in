declare module "numeral" {
  interface Numeral {
    format(input: string): string;
  }

  interface NumeralStatic {
    (value?: number | string | null): Numeral;
  }

  const numeral: NumeralStatic;
  export default numeral;
}

export * from "./generated/api";
export * from "./generated/types";
// Resolve TS2308: ExtendEmailResponse ada di kedua modul generated;
// export eksplisit (skema zod) menang atas export *.
export { ExtendEmailResponse } from "./generated/api";

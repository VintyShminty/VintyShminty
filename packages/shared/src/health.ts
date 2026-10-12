import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const healthDbResponseSchema = z.object({
  ok: z.boolean(),
  database: z.enum(["up", "down"]),
});
export type HealthDbResponse = z.infer<typeof healthDbResponseSchema>;

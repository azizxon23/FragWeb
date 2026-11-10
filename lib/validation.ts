import { z } from "zod";
import type { ErrorInfo } from "./errors";
export const cityValues = [
  "Tashkent",
  "Samarkand",
  "Bukhara",
  "Andijan",
  "Namangan",
  "Fergana",
  "Nukus",
  "Qarshi",
  "Jizzakh",
  "Navoi",
  "Termez",
  "Urgench",
  "Gulistan",
] as const;
export const profileInput = z.object({
  displayName: z.string().trim().min(2).max(70),
  phone: z.string().regex(/^\+998[0-9]{9}$/),
  telegram: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/),
  city: z.enum(cityValues),
  bio: z.string().trim().max(500).default(""),
  avatar: z.union([z.literal(""), z.string().regex(/^\/api\/images\/[a-f0-9-]+\.(jpg|png|webp)$/)]).default(""),
});
export const listingInput = z
  .object({
    seller: z.string().trim().min(2).max(70),
    phone: z.string().regex(/^\+998[0-9]{9}$/),
    telegram: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/),
    city: z.enum(cityValues),
    brand: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(100),
    gender: z.enum(["men", "women", "unisex"]),
    size: z.number().int().min(1).max(2000),
    remaining: z.number().int().min(1).max(2000),
    price: z.number().int().min(1000).max(100000000),
    condition: z.enum(["box", "bottle"]),
    description: z.string().trim().min(15).max(2000),
    photos: z
      .array(z.string().regex(/^\/api\/images\/[a-f0-9-]+\.(jpg|png|webp)$/))
      .min(1)
      .max(4),
  })
  .refine((v) => v.remaining <= v.size, {
    message: "volume",
    path: ["remaining"],
  });
export const adminAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("userStatus"),
    id: z.string().uuid(),
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().min(5).max(300),
  }),
  z.object({
    action: z.literal("moderateListing"),
    id: z.string().uuid(),
    visibility: z.enum(["visible", "hidden"]),
    reason: z.string().trim().min(5).max(300),
  }),
]);
export function validationIssue(issue: z.ZodIssue): ErrorInfo {
  const field = String(issue.path[0] || "");
  if (issue.code === "custom" && issue.message === "volume")
    return { code: "volume", field };
  if (field === "phone") return { code: "phone", field };
  if (field === "telegram") return { code: "username", field };
  if (field === "photos") return { code: "photos", field };
  if (field === "reason") return { code: "reason", field };
  if (issue.code === "too_small")
    return {
      code: issue.type === "string" ? "minLength" : "min",
      limit: Number(issue.minimum),
      field,
    };
  if (issue.code === "too_big")
    return {
      code: issue.type === "string" ? "maxLength" : "max",
      limit: Number(issue.maximum),
      field,
    };
  return { code: "invalid", field };
}

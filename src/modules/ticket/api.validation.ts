import { z } from "zod";
import { CHANNELS, LOCALES } from "./api.constant.js";

export const sortTicketSchema = z.object({
  ticket_id: z.string().trim().min(1, "ticket_id is required"),
  channel: z.enum(CHANNELS).optional(),
  locale: z.enum(LOCALES).optional(),
  message: z.string().trim().min(1, "message is required"),
});

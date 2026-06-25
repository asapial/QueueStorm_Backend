import type { RequestHandler } from "express";
import { sortTicket } from "./api.service.js";
import { sortTicketSchema } from "./api.validation.js";

export const sortTicketController: RequestHandler = async (req, res, next) => {
  try {
    const payload = sortTicketSchema.parse(req.body);
    const result = await sortTicket(payload);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

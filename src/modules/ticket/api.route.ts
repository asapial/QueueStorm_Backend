import { Router } from "express";
import { sortTicketController } from "./api.controller";


export const ticketRouter = Router();

ticketRouter.post("/sort-ticket", sortTicketController);

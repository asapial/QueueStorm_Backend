import { ZodError } from "zod";
import type { TErrorResponse, TErrorSources } from "../interfaces/error.interface.js";

export const handleZodError = (err: ZodError): TErrorResponse => {
  const statusCode = 400;
  const message = "Zod Validation Error";

  const errorSources: TErrorSources[] = err.issues.map((issue) => ({
    path: issue.path.join(" => "),
    message: issue.message,
  }));

  return {
    success: false,
    message,
    errorSources,
    statusCode,
  };
};

export type TErrorSource = {
  path: string;
  message: string;
};

export type TErrorSources = TErrorSource;

export type TErrorResponse = {
  success: false;
  message: string;
  errorSources: TErrorSources[];
  statusCode: number;
};

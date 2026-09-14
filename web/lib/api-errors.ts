import { InputError } from "./input.ts";

export const apiErrorResponse = (error: unknown) => {
  if (error instanceof InputError || error instanceof SyntaxError) {
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid JSON request."
            : error.message,
      },
      { status: 400 },
    );
  }
  console.error("API request failed", error);
  return Response.json(
    { error: "The service is temporarily unavailable. Try again." },
    { status: 503 },
  );
};

export const parseRecordId = (value: string) => {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0)
    throw new InputError("Invalid record ID.");
  return id;
};

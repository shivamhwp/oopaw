import { Result } from "better-result";

export const unwrapOrThrow = <Value, ErrorType extends Error>(result: Result<Value, ErrorType>) =>
  result.match({
    ok: (value) => value,
    err: (error) => {
      throw error;
    },
  });

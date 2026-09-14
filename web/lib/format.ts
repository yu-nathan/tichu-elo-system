export const formatRatio = (successes: number, attempts: number) =>
  attempts ? `${successes}/${attempts}` : "N/A";

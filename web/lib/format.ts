export const formatRatio = (successes: number, attempts: number) =>
  attempts ? `${successes}/${attempts}` : "N/A";

export const formatPercentage = (successes: number, attempts: number) =>
  attempts ? `${((successes / attempts) * 100).toFixed(1)}%` : "N/A";

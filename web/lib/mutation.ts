export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// A committed mutation stays successful even if the subsequent read fails.
export const mutateAndRefresh = async <T>(
  mutate: () => Promise<void>,
  refresh: () => Promise<T>,
): Promise<
  { saved: false; error: string } | { saved: true; data?: T; warning?: string }
> => {
  try {
    await mutate();
  } catch (error) {
    return {
      saved: false,
      error: errorMessage(error, "The change could not be saved."),
    };
  }
  try {
    return { saved: true, data: await refresh() };
  } catch {
    return {
      saved: true,
      warning:
        "Your change was saved, but the latest data could not be loaded. Refresh the data before making more changes.",
    };
  }
};

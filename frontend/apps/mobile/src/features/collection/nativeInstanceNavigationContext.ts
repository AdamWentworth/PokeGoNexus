type NativeInstanceNavigationContext = {
  orderedInstanceIds: string[];
};

let currentContext: NativeInstanceNavigationContext | null = null;

const normalizedIds = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

export const setNativeInstanceNavigationContext = (orderedInstanceIds: string[]): void => {
  currentContext = { orderedInstanceIds: normalizedIds(orderedInstanceIds) };
};

export const getNativeInstanceNavigationContext = (): NativeInstanceNavigationContext | null => (
  currentContext ? { orderedInstanceIds: [...currentContext.orderedInstanceIds] } : null
);

export const clearNativeInstanceNavigationContext = (): void => {
  currentContext = null;
};

type NativeInstanceSiblingRouter = {
  setParams: (params: { instanceId: string }) => void;
};

/**
 * Change the instance inside the current overlay route without dispatching a
 * native-stack transition. The overlay owns the canonical horizontal motion;
 * replacing the route here would add a second bottom-up animation afterward.
 */
export const navigateNativeInstanceSibling = (
  router: NativeInstanceSiblingRouter,
  instanceId: string,
): void => {
  router.setParams({ instanceId });
};

export const resolveNativeInstanceNeighbors = ({
  instanceId,
  fallbackIds,
}: {
  instanceId: string;
  fallbackIds: string[];
}): { previousId: string | null; nextId: string | null } => {
  const contextual = currentContext?.orderedInstanceIds ?? [];
  const ordered = contextual.includes(instanceId) ? contextual : normalizedIds(fallbackIds);
  const index = ordered.indexOf(instanceId);
  if (index < 0) return { previousId: null, nextId: null };
  return {
    previousId: index > 0 ? ordered[index - 1] : null,
    nextId: index < ordered.length - 1 ? ordered[index + 1] : null,
  };
};

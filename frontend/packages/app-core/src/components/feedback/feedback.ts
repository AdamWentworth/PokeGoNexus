export type FeedbackKind = 'success' | 'error' | 'info' | 'warning';

export type FeedbackAction = {
  label: string;
  onClick: () => void;
};

export type FeedbackOptions = {
  id?: string;
  duration?: number | false;
  action?: FeedbackAction;
};

export type FeedbackItem = {
  id: string;
  kind: FeedbackKind;
  message: string;
  duration: number | false;
  action?: FeedbackAction;
  revision: number;
};

type FeedbackListener = () => void;

const MAX_VISIBLE_FEEDBACK = 4;
const DEFAULT_DURATION: Record<FeedbackKind, number> = {
  success: 4_500,
  info: 5_500,
  warning: 6_500,
  error: 7_500,
};

let feedbackItems: FeedbackItem[] = [];
let nextFeedbackId = 0;
let nextRevision = 0;
const listeners = new Set<FeedbackListener>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const addFeedback = (
  kind: FeedbackKind,
  message: string,
  options: FeedbackOptions = {},
): string => {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return '';

  const id = options.id ?? `feedback-${++nextFeedbackId}`;
  const item: FeedbackItem = {
    id,
    kind,
    message: normalizedMessage,
    duration: options.duration ?? DEFAULT_DURATION[kind],
    action: options.action,
    revision: ++nextRevision,
  };

  feedbackItems = [
    ...feedbackItems.filter((current) => current.id !== id),
    item,
  ].slice(-MAX_VISIBLE_FEEDBACK);
  emit();
  return id;
};

const dismissFeedback = (id: string) => {
  const nextItems = feedbackItems.filter((item) => item.id !== id);
  if (nextItems.length === feedbackItems.length) return;
  feedbackItems = nextItems;
  emit();
};

const clearFeedback = () => {
  if (feedbackItems.length === 0) return;
  feedbackItems = [];
  emit();
};

export const feedback = {
  success: (message: string, options?: FeedbackOptions) =>
    addFeedback('success', message, options),
  error: (message: string, options?: FeedbackOptions) =>
    addFeedback('error', message, options),
  info: (message: string, options?: FeedbackOptions) =>
    addFeedback('info', message, options),
  warning: (message: string, options?: FeedbackOptions) =>
    addFeedback('warning', message, options),
  dismiss: dismissFeedback,
  clear: clearFeedback,
};

export const subscribeToFeedback = (listener: FeedbackListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getFeedbackSnapshot = () => feedbackItems;

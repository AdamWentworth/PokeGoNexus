import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiX,
} from 'react-icons/fi';

import {
  feedback,
  getFeedbackSnapshot,
  subscribeToFeedback,
  type FeedbackItem,
  type FeedbackKind,
} from './feedback';
import './FeedbackProvider.css';

const EMPTY_FEEDBACK: FeedbackItem[] = [];

const icons: Record<FeedbackKind, React.ReactNode> = {
  success: <FiCheckCircle aria-hidden="true" />,
  error: <FiAlertCircle aria-hidden="true" />,
  info: <FiInfo aria-hidden="true" />,
  warning: <FiAlertTriangle aria-hidden="true" />,
};

const labels: Record<FeedbackKind, string> = {
  success: 'Success',
  error: 'Something went wrong',
  info: 'Notice',
  warning: 'Heads up',
};

const FeedbackCard: React.FC<{ item: FeedbackItem }> = ({ item }) => {
  useEffect(() => {
    if (item.duration === false) return undefined;
    const timeout = window.setTimeout(
      () => feedback.dismiss(item.id),
      item.duration,
    );
    return () => window.clearTimeout(timeout);
  }, [item.duration, item.id, item.revision]);

  const handleAction = () => {
    item.action?.onClick();
    feedback.dismiss(item.id);
  };

  return (
    <article
      className={`feedback-card feedback-card--${item.kind}`}
      role={item.kind === 'error' ? 'alert' : 'status'}
      data-feedback-id={item.id}
    >
      <span className="feedback-card__icon">{icons[item.kind]}</span>
      <div className="feedback-card__content">
        <strong>{labels[item.kind]}</strong>
        <p>{item.message}</p>
      </div>
      {item.action ? (
        <button
          type="button"
          className="feedback-card__action"
          onClick={handleAction}
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        className="feedback-card__dismiss"
        aria-label={`Dismiss ${labels[item.kind].toLowerCase()} notification`}
        onClick={() => feedback.dismiss(item.id)}
      >
        <FiX aria-hidden="true" />
      </button>
    </article>
  );
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const items = useSyncExternalStore(
    subscribeToFeedback,
    getFeedbackSnapshot,
    () => EMPTY_FEEDBACK,
  );

  return (
    <>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <section
              className="feedback-viewport"
              aria-label="Notifications"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {items.map((item) => (
                <FeedbackCard key={item.id} item={item} />
              ))}
            </section>,
            document.body,
          )
        : null}
    </>
  );
};

export default FeedbackProvider;

import {
  FaArrowRight,
  FaCheck,
  FaExchangeAlt,
  FaHeart,
  FaSearch,
  FaTags,
} from 'react-icons/fa';
import { Link } from 'react-router';

import type { User } from '@/types/auth';

import type { HomeOnboardingProgress, HomeOnboardingTask } from './homeDashboardModel';

interface HomeOnboardingProps {
  user: User;
  progress: HomeOnboardingProgress;
  onDismiss: () => void;
}

const taskIcons: Record<HomeOnboardingTask['id'], typeof FaTags> = {
  collection: FaTags,
  wanted: FaHeart,
  trade: FaExchangeAlt,
  connect: FaSearch,
};

const HomeOnboarding = ({ user, progress, onDismiss }: HomeOnboardingProps) => {
  const displayName = user.pokemonGoName?.trim() || user.username;
  const percent = Math.round((progress.completed / progress.total) * 100);

  return (
    <section className="home-onboarding" aria-labelledby="home-onboarding-title">
      <div className="home-onboarding__intro">
        <span className="home-eyebrow">Welcome, {displayName}</span>
        <h1 id="home-onboarding-title">Let’s make your account useful.</h1>
        <p>Start with the collection you already know. We’ll reveal the trading workflow as you build it.</p>
        <div className="home-onboarding__progress" aria-label={`${progress.completed} of ${progress.total} setup milestones complete`}>
          <span><strong>{progress.completed} of {progress.total}</strong> milestones complete</span>
          <span aria-hidden="true"><i style={{ width: `${percent}%` }} /></span>
        </div>
      </div>

      <ol className="home-onboarding__tasks">
        {progress.tasks.map((task, index) => {
          const Icon = taskIcons[task.id];
          return (
            <li key={task.id} className={task.complete ? 'is-complete' : ''}>
              <span className="home-onboarding__task-number" aria-hidden="true">
                {task.complete ? <FaCheck /> : index + 1}
              </span>
              <span className="home-onboarding__task-icon" aria-hidden="true"><Icon /></span>
              <span className="home-onboarding__task-copy">
                <strong>{task.title}</strong>
                <small>{task.description}</small>
              </span>
              {task.complete ? (
                <span className="home-onboarding__done">Done</span>
              ) : (
                <Link to={task.to}>{task.action}<FaArrowRight aria-hidden="true" /></Link>
              )}
            </li>
          );
        })}
      </ol>

      <div className="home-onboarding__footer">
        <Link to="/getting-started">Read the complete guide <FaArrowRight aria-hidden="true" /></Link>
        <button type="button" onClick={onDismiss}>Open trainer dashboard</button>
      </div>
    </section>
  );
};

export default HomeOnboarding;

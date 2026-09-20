import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaBan,
  FaCheck,
  FaClock,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUndo,
  FaUserFriends,
  FaUserPlus,
} from "react-icons/fa";
import { useNavigate } from "react-router";
import { feedback } from '@/components/feedback';

import { useModal } from "@/contexts/ModalContext";
import HorizontalPageSlider from "@/components/motion/HorizontalPageSlider";
import useHorizontalPageNavigation from "@/components/motion/useHorizontalPageNavigation";
import {
  acceptFriendRequest,
  deleteFriendRequest,
  fetchFriendsOverview,
  removeFriend,
  sendFriendRequest,
  unblockTrainer,
} from "@/services/socialService";
import { fetchTrainerAutocomplete } from "@/services/userSearchService";
import { useAuthStore } from "@/stores/useAuthStore";
import { socialQueryKeys } from "@/services/queryClient";
import type {
  FriendSummary,
  FriendsOverview,
  TrainerAutocompleteEntry,
} from "@shared-contracts/users";

import TrainerPageShell from "./TrainerPageShell";

type FriendsTab = "friends" | "requests" | "find" | "blocked";

const FRIEND_TABS = ["friends", "requests", "find", "blocked"] as const;

const emptyOverview: FriendsOverview = {
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};

const TrainerRow = ({
  trainer,
  actions,
  onOpen,
}: {
  trainer: FriendSummary | TrainerAutocompleteEntry;
  actions?: React.ReactNode;
  onOpen?: () => void;
}) => {
  const identity = (
    <>
      <strong>{trainer.pokemonGoName || trainer.username}</strong>
      <span>
        @{trainer.username}
        {trainer.team ? ` · ${trainer.team}` : ""}
        {trainer.trainer_level ? ` · Level ${trainer.trainer_level}` : ""}
      </span>
    </>
  );

  return (
    <article className="trainer-person-row">
      {onOpen ? (
        <button
          type="button"
          className="trainer-avatar"
          onClick={onOpen}
          aria-label={`Open ${trainer.username}'s profile`}
        >
          {trainer.username.slice(0, 1).toUpperCase()}
        </button>
      ) : (
        <span className="trainer-avatar" aria-hidden="true">
          {trainer.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      {onOpen ? (
        <button type="button" className="trainer-person-copy" onClick={onOpen}>
          {identity}
        </button>
      ) : (
        <span className="trainer-person-copy trainer-person-copy-static">
          {identity}
        </span>
      )}
      <div className="trainer-row-actions">{actions}</div>
    </article>
  );
};

const Friends = () => {
  const navigate = useNavigate();
  const { confirm } = useModal();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<FriendsTab>("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrainerAutocompleteEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const tabSlider = useHorizontalPageNavigation({
    pages: FRIEND_TABS,
    activePage: tab,
    onChange: setTab,
  });

  const friendsQuery = useQuery({
    queryKey: socialQueryKeys.friends,
    queryFn: fetchFriendsOverview,
    enabled: Boolean(user),
  });
  const overview = friendsQuery.data ?? emptyOverview;
  const loading = friendsQuery.isLoading;

  useEffect(() => {
    if (!user) navigate("/login", { replace: true });
  }, [navigate, user]);
  useEffect(() => {
    if (friendsQuery.error) {
      feedback.error(
        friendsQuery.error instanceof Error
          ? friendsQuery.error.message
          : "Could not load friends.",
      );
    }
  }, [friendsQuery.error]);

  const runSearch = async () => {
    if (query.trim().length < 2) {
      feedback.info("Enter at least two characters.");
      return;
    }
    setSearching(true);
    const outcome = await fetchTrainerAutocomplete(query.trim());
    setSearching(false);
    if (outcome.type === "error") {
      feedback.error(outcome.message);
      setResults([]);
      return;
    }
    setResults(
      outcome.results.filter(
        (entry) =>
          entry.username.toLowerCase() !== user?.username.toLowerCase(),
      ),
    );
  };

  const refreshAfter = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      await action();
      feedback.success(successMessage);
      await queryClient.invalidateQueries({ queryKey: socialQueryKeys.friends });
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "Action failed.");
    }
  };

  const remove = async (trainer: FriendSummary) => {
    const approved = await confirm(
      `Remove ${trainer.username} from your friends?`,
    );
    if (!approved) return;
    await refreshAfter(() => removeFriend(trainer.user_id), "Friend removed");
  };

  const openProfile = (username: string) =>
    navigate(`/profile/${encodeURIComponent(username)}`, {
      state: { contextBackTo: "/profile/friends" },
    });

  return (
    <TrainerPageShell
      workspace="profile"
      eyebrow="Trainer network"
      title="Friends"
      actions={
        overview.incoming.length ? (
          <span className="trainer-count-badge">
            {overview.incoming.length} request
            {overview.incoming.length === 1 ? "" : "s"}
          </span>
        ) : null
      }
    >
      <nav className="trainer-tabs" aria-label="Friends views">
        <button
          type="button"
          className={tab === "friends" ? "active" : ""}
          onClick={() => setTab("friends")}
        >
          <FaUserFriends />
          Friends
          <span>{overview.friends.length}</span>
        </button>
        <button
          type="button"
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          <FaClock />
          Requests
          <span>{overview.incoming.length + overview.outgoing.length}</span>
        </button>
        <button
          type="button"
          className={tab === "find" ? "active" : ""}
          onClick={() => setTab("find")}
        >
          <FaSearch />
          Find
        </button>
        <button
          type="button"
          className={tab === "blocked" ? "active" : ""}
          onClick={() => setTab("blocked")}
        >
          <FaBan />
          Blocked
          <span>{overview.blocked.length}</span>
        </button>
      </nav>

      {loading ? (
        <div className="trainer-status">Loading friends...</div>
      ) : null}

      <HorizontalPageSlider
        activeIndex={tabSlider.activeIndex}
        className="trainer-page-slider"
        viewportRef={tabSlider.viewportRef}
        dragOffset={tabSlider.dragOffset}
        isDragging={tabSlider.isDragging}
        {...tabSlider.swipeHandlers}
      >
        <div>
      {!loading ? (
        <section className="trainer-section">
          <header>
            <div>
              <span>Connected trainers</span>
              <h2>Your friends</h2>
            </div>
          </header>
          <div className="trainer-people-list">
            {overview.friends.map((trainer) => (
              <TrainerRow
                key={trainer.user_id}
                trainer={trainer}
                onOpen={() => openProfile(trainer.username)}
                actions={
                  <button
                    type="button"
                    className="trainer-icon-button trainer-danger-icon"
                    title="Remove friend"
                    aria-label={`Remove ${trainer.username}`}
                    onClick={() => void remove(trainer)}
                  >
                    <FaTrash />
                  </button>
                }
              />
            ))}
          </div>
          {!overview.friends.length ? (
            <p className="trainer-empty">
              Your friends will appear here. Find a trainer to get started.
            </p>
          ) : null}
        </section>
      ) : null}
        </div>

        <div>
      {!loading ? (
        <div className="trainer-section-stack">
          <section className="trainer-section">
            <header>
              <div>
                <span>Needs your answer</span>
                <h2>Incoming requests</h2>
              </div>
            </header>
            <div className="trainer-people-list">
              {overview.incoming.map((trainer) => (
                <TrainerRow
                  key={trainer.friendship_id}
                  trainer={trainer}
                  onOpen={() => openProfile(trainer.username)}
                  actions={
                    <>
                      <button
                        type="button"
                        className="trainer-icon-button trainer-success-icon"
                        title="Accept request"
                        aria-label={`Accept ${trainer.username}`}
                        onClick={() =>
                          void refreshAfter(
                            () => acceptFriendRequest(trainer.friendship_id),
                            "Friend request accepted",
                          )
                        }
                      >
                        <FaCheck />
                      </button>
                      <button
                        type="button"
                        className="trainer-icon-button trainer-danger-icon"
                        title="Decline request"
                        aria-label={`Decline ${trainer.username}`}
                        onClick={() =>
                          void refreshAfter(
                            () => deleteFriendRequest(trainer.friendship_id),
                            "Friend request declined",
                          )
                        }
                      >
                        <FaTimes />
                      </button>
                    </>
                  }
                />
              ))}
            </div>
            {!overview.incoming.length ? (
              <p className="trainer-empty">No incoming requests.</p>
            ) : null}
          </section>

          <section className="trainer-section">
            <header>
              <div>
                <span>Waiting for a response</span>
                <h2>Sent requests</h2>
              </div>
            </header>
            <div className="trainer-people-list">
              {overview.outgoing.map((trainer) => (
                <TrainerRow
                  key={trainer.friendship_id}
                  trainer={trainer}
                  onOpen={() => openProfile(trainer.username)}
                  actions={
                    <button
                      type="button"
                      className="trainer-icon-button"
                      title="Cancel request"
                      aria-label={`Cancel request to ${trainer.username}`}
                      onClick={() =>
                        void refreshAfter(
                          () => deleteFriendRequest(trainer.friendship_id),
                          "Friend request canceled",
                        )
                      }
                    >
                      <FaTimes />
                    </button>
                  }
                />
              ))}
            </div>
            {!overview.outgoing.length ? (
              <p className="trainer-empty">No sent requests.</p>
            ) : null}
          </section>
        </div>
      ) : null}
        </div>

        <div>
        <section className="trainer-section">
          <header>
            <div>
              <span>Search Pokémon Go Nexus</span>
              <h2>Find trainers</h2>
            </div>
          </header>
          <form
            className="trainer-search"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <FaSearch />
            <input
              value={query}
              placeholder="Username or Pokemon GO name"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="submit"
              className="trainer-button trainer-button-primary"
              disabled={searching}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
          <div className="trainer-people-list">
            {results.map((trainer) => (
              <TrainerRow
                key={trainer.username}
                trainer={trainer}
                onOpen={() => openProfile(trainer.username)}
                actions={
                  <button
                    type="button"
                    className="trainer-icon-button trainer-success-icon"
                    title="Send friend request"
                    aria-label={`Add ${trainer.username}`}
                    onClick={() =>
                      void refreshAfter(
                        () => sendFriendRequest(trainer.username),
                        "Friend request sent",
                      )
                    }
                  >
                    <FaUserPlus />
                  </button>
                }
              />
            ))}
          </div>
        </section>
        </div>

        <div>
      {!loading ? (
        <section className="trainer-section">
          <header>
            <div>
              <span>Hidden trainers</span>
              <h2>Blocked trainers</h2>
            </div>
          </header>
          <div className="trainer-people-list">
            {overview.blocked.map((trainer) => (
              <TrainerRow
                key={trainer.user_id}
                trainer={trainer}
                actions={
                  <button
                    type="button"
                    className="trainer-button trainer-button-secondary"
                    onClick={() =>
                      void refreshAfter(
                        () => unblockTrainer(trainer.user_id),
                        "Trainer unblocked",
                      )
                    }
                  >
                    <FaUndo />
                    Unblock
                  </button>
                }
              />
            ))}
          </div>
          {!overview.blocked.length ? (
            <p className="trainer-empty">You have not blocked any trainers.</p>
          ) : null}
        </section>
      ) : null}
        </div>
      </HorizontalPageSlider>
    </TrainerPageShell>
  );
};

export default Friends;

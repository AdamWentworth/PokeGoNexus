import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import type { IconType } from "react-icons";
import {
  FaBan,
  FaCalendarAlt,
  FaCheck,
  FaEdit,
  FaExchangeAlt,
  FaGripVertical,
  FaHeart,
  FaIdCard,
  FaMapMarkerAlt,
  FaMedal,
  FaRulerCombined,
  FaStar,
  FaTimes,
  FaUserCheck,
  FaUserClock,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router";
import { feedback } from '@/components/feedback';

import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import {
  acceptFriendRequest,
  blockTrainer,
  deleteFriendRequest,
  fetchOwnTrainerProfile,
  fetchTrainerProfile,
  removeFriend,
  sendFriendRequest,
  updateTrainerProfile,
} from "@/services/socialService";
import { useAuthStore } from "@/stores/useAuthStore";
import { socialQueryKeys } from "@/services/queryClient";
import { useInstancesStore } from "@/features/instances/store/useInstancesStore";
import { useVariantsStore } from "@/features/variants/store/useVariantsStore";
import {
  resolvePokemonDisplayAttributes,
  resolvePokemonDisplayImageUrl,
} from "@/features/pokemonDisplay/pokemonDisplayPresentation";
import type { PokemonInstance } from "@/types/pokemonInstance";
import type { PokemonVariant } from "@/types/pokemonVariants";
import type {
  TrainerProfile,
  TrainerTitle,
  UpdateTrainerProfileRequest,
} from "@shared-contracts/users";
import {
  TRAINER_TITLE_OPTIONS,
  TRAINER_TITLE_VISUALS,
} from "@shared-contracts/users";

import TrainerPageShell from "./TrainerPageShell";
import TrainerShowcasePicker from "./TrainerShowcasePicker";
import {
  normalizeTrainerShowcaseSlots,
  reorderTrainerShowcaseSlots,
  TRAINER_SHOWCASE_SLOT_COUNT,
} from "./trainerShowcaseSlots";
import {
  buildPokemonCatalogPath,
  type PokemonCatalogFilter,
} from "@/pages/Pokemon/utils/pokemonCatalogNavigation";

type ProfileForm = {
  trainerTitles: TrainerTitle[];
  pokemonGoName: string;
  trainerCode: string;
  team: string;
  trainerLevel: string;
  totalXp: string;
  startedOn: string;
  location: string;
};

type TextProfileField = Exclude<keyof ProfileForm, "trainerTitles">;

const emptyForm: ProfileForm = {
  trainerTitles: [],
  pokemonGoName: "",
  trainerCode: "",
  team: "",
  trainerLevel: "",
  totalXp: "",
  startedOn: "",
  location: "",
};

const emptyHighlightSlots = () =>
  Array<string>(TRAINER_SHOWCASE_SLOT_COUNT).fill("");

const SHOWCASE_DRAG_THRESHOLD_PX = 7;

const trainerTitleOptionByID = new Map(
  TRAINER_TITLE_OPTIONS.map((option) => [option.id, option]),
);

type TrainerCollectionVisual =
  | {
      icon: IconType;
    }
  | {
      mask: string;
    };

type TrainerCollectionItem = {
  label: string;
  value?: number | null;
  visual: TrainerCollectionVisual;
  filter?: PokemonCatalogFilter;
};

const TrainerCollectionIcon = ({
  label,
  visual,
}: {
  label: string;
  visual: TrainerCollectionVisual;
}) => {
  if ("mask" in visual) {
    return (
      <span
        aria-hidden="true"
        className="trainer-card-collection-icon trainer-card-collection-mask"
        data-collection-icon={label.toLowerCase().replaceAll(" ", "-")}
        style={{
          WebkitMaskImage: `url("${visual.mask}")`,
          maskImage: `url("${visual.mask}")`,
        }}
      />
    );
  }

  const Icon = visual.icon;
  return (
    <span
      aria-hidden="true"
      className="trainer-card-collection-icon"
      data-collection-icon={label.toLowerCase().replaceAll(" ", "-")}
    >
      <Icon />
    </span>
  );
};

const trainerTitleFallbackIcon = {
  medal: FaMedal,
  ruler: FaRulerCombined,
  users: FaUsers,
} satisfies Record<'medal' | 'ruler' | 'users', IconType>;

const TrainerTitleVisual = ({ title }: { title: TrainerTitle }) => {
  const visual = TRAINER_TITLE_VISUALS[title];

  if ("masks" in visual) {
    return (
      <span
        className={`trainer-title-visual ${
          visual.masks.length > 1 ? "trainer-title-visual-pair" : ""
        }`}
        aria-hidden="true"
      >
        {visual.masks.map((mask) => (
          <span
            className="trainer-title-native-mask"
            data-title-asset={mask}
            style={{
              WebkitMaskImage: `url("${mask}")`,
              maskImage: `url("${mask}")`,
            }}
            key={mask}
          />
        ))}
      </span>
    );
  }

  const Icon = trainerTitleFallbackIcon[visual.icon];
  return (
    <span className="trainer-title-visual trainer-title-visual-fallback">
      <Icon aria-hidden="true" />
    </span>
  );
};

type ShowcasePointerDrag = {
  pointerId: number;
  currentIndex: number;
  instanceId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  activated: boolean;
};

type ShowcaseDragPreview = {
  instanceId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

const toDateInput = (value?: string | null) =>
  value ? value.slice(0, 10) : "";

const formatNumber = (value?: number | null) =>
  typeof value === "number" ? value.toLocaleString() : "-";

const formatDate = (value?: string | null) => {
  if (!value) return "Not shared";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not shared";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatCalendarDate = (value?: string | null) => {
  if (!value) return "Not shared";
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!dateParts) return formatDate(value);

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(
    new Date(
      Number(dateParts[1]),
      Number(dateParts[2]) - 1,
      Number(dateParts[3]),
    ),
  );
};

const formatTrainerCode = (value?: string | null) =>
  value ? value.replace(/(\d{4})(?=\d)/g, "$1 ") : "Not shared";

const profileToForm = (
  profile: TrainerProfile<PokemonInstance>,
): ProfileForm => ({
  trainerTitles: profile.trainer_titles ?? [],
  pokemonGoName: profile.user.pokemonGoName ?? "",
  trainerCode: profile.trainer_code ?? "",
  team: profile.user.team ?? "",
  trainerLevel: profile.user.trainer_level?.toString() ?? "",
  totalXp: profile.user.total_xp?.toString() ?? "",
  startedOn: toDateInput(profile.user.pogo_started_on),
  location: profile.location ?? "",
});

const HighlightCardContent = ({
  instance,
  variant,
}: {
  instance: PokemonInstance;
  variant?: PokemonVariant;
}) => {
  if (!variant) {
    return (
      <>
        <div className="trainer-card-highlight-placeholder">
          #{instance.pokemon_id}
        </div>
        <div>
          <strong>
            {instance.nickname || `Pokemon #${instance.pokemon_id}`}
          </strong>
          <span>Featured Pokemon</span>
        </div>
      </>
    );
  }

  const pokemon = { ...variant, instanceData: instance };
  const image = resolvePokemonDisplayImageUrl({
    pokemon,
    attributes: resolvePokemonDisplayAttributes(pokemon),
  });

  return (
    <>
      <img src={image} alt="" draggable={false} />
      <div>
        <strong>{instance.nickname || variant.species_name}</strong>
        <span>
          {instance.cp
            ? `CP ${instance.cp.toLocaleString()}`
            : "Featured Pokemon"}
        </span>
      </div>
    </>
  );
};

const Profile = () => {
  const { username: routeUsername } = useParams();
  const navigate = useNavigate();
  const { confirm } = useModal();
  const queryClient = useQueryClient();
  const { updateUserDetails } = useAuth();
  const authUser = useAuthStore((state) => state.user);
  const variants = useVariantsStore((state) => state.variants);
  const instances = useInstancesStore((state) => state.instances);

  const username = routeUsername || authUser?.username || "";
  const isOwner =
    Boolean(authUser) &&
    (!routeUsername ||
      routeUsername.toLowerCase() === authUser?.username.toLowerCase());

  const [profile, setProfile] =
    useState<TrainerProfile<PokemonInstance> | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [highlightIds, setHighlightIds] =
    useState<string[]>(emptyHighlightSlots);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingHighlightSlot, setEditingHighlightSlot] = useState<
    number | null
  >(null);
  const [draggingHighlightSlot, setDraggingHighlightSlot] = useState<
    number | null
  >(null);
  const [showcaseDragPreview, setShowcaseDragPreview] =
    useState<ShowcaseDragPreview | null>(null);
  const showcasePointerDrag = useRef<ShowcasePointerDrag | null>(null);
  const suppressShowcaseClick = useRef(false);
  const [error, setError] = useState("");

  const profileQuery = useQuery({
    queryKey: socialQueryKeys.profile(username),
    queryFn: () =>
      isOwner ? fetchOwnTrainerProfile() : fetchTrainerProfile(username),
    enabled: Boolean(username),
    staleTime: isOwner ? 60_000 : 30_000,
  });
  const loading = profileQuery.isLoading;

  const loadProfile = useCallback(async () => {
    if (!username) {
      navigate("/login", { replace: true });
      return;
    }
    setError("");
    try {
      const nextProfile = await queryClient.fetchQuery({
        queryKey: socialQueryKeys.profile(username),
        queryFn: () =>
          isOwner ? fetchOwnTrainerProfile() : fetchTrainerProfile(username),
        staleTime: 0,
      });
      setProfile(nextProfile);
      setForm(profileToForm(nextProfile));
      setHighlightIds(
        normalizeTrainerShowcaseSlots(
          nextProfile.highlights.map(
            (entry) => entry.instance_id || "",
          ),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this trainer.",
      );
    }
  }, [isOwner, navigate, queryClient, username]);

  useEffect(() => {
    if (!username) {
      navigate("/login", { replace: true });
      return;
    }
    if (profileQuery.data && !editing) {
      setProfile(profileQuery.data);
      setForm(profileToForm(profileQuery.data));
      setHighlightIds(
        normalizeTrainerShowcaseSlots(
          profileQuery.data.highlights.map((entry) => entry.instance_id || ""),
        ),
      );
    }
    if (profileQuery.error) {
      setError(
        profileQuery.error instanceof Error
          ? profileQuery.error.message
          : "Could not load this trainer.",
      );
    }
  }, [editing, navigate, profileQuery.data, profileQuery.error, username]);

  const variantByID = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_id, variant])),
    [variants],
  );
  const highlightCandidates = useMemo(() => {
    const byID = new Map<string, PokemonInstance>();
    Object.values(instances).forEach((instance) => {
      if (instance.instance_id && instance.is_caught && !instance.disabled) {
        byID.set(instance.instance_id, instance);
      }
    });
    profile?.highlights.forEach((instance) => {
      if (instance.instance_id) {
        byID.set(instance.instance_id, instance);
      }
    });
    return [...byID.values()].sort((left, right) => {
      const leftName =
        left.nickname ||
        variantByID.get(left.variant_id)?.species_name ||
        `Pokemon #${left.pokemon_id}`;
      const rightName =
        right.nickname ||
        variantByID.get(right.variant_id)?.species_name ||
        `Pokemon #${right.pokemon_id}`;
      return (
        Number(Boolean(right.favorite)) - Number(Boolean(left.favorite)) ||
        (right.cp ?? 0) - (left.cp ?? 0) ||
        leftName.localeCompare(rightName)
      );
    });
  }, [instances, profile?.highlights, variantByID]);
  const highlightCandidateByID = useMemo(
    () =>
      new Map(
        highlightCandidates
          .filter((instance) => Boolean(instance.instance_id))
          .map((instance) => [instance.instance_id || "", instance]),
      ),
    [highlightCandidates],
  );
  const cardHighlights = useMemo(
    () =>
      editing
        ? highlightIds
            .filter(Boolean)
            .map((instanceID) => highlightCandidateByID.get(instanceID))
            .filter((instance): instance is PokemonInstance =>
              Boolean(instance),
            )
        : (profile?.highlights ?? []),
    [
      editing,
      highlightCandidateByID,
      highlightIds,
      profile?.highlights,
    ],
  );
  const draggedHighlight = showcaseDragPreview
    ? highlightCandidateByID.get(showcaseDragPreview.instanceId)
    : undefined;
  const cardTeam = (
    (editing ? form.team : profile?.user.team) || "neutral"
  ).toLowerCase();
  const cardTrainerLevel = editing
    ? Number(form.trainerLevel) || null
    : profile?.user.trainer_level ?? null;
  const currentProfilePath = routeUsername
    ? `/profile/${encodeURIComponent(routeUsername)}`
    : "/profile";
  const needsProfileSetup =
    isOwner &&
    profile !== null &&
    (profile.trainer_titles?.length ?? 0) === 0 &&
    !profile.user.team &&
    !profile.user.trainer_level &&
    !profile.user.total_xp &&
    !profile.user.pogo_started_on &&
    !profile.location &&
    !profile.trainer_code &&
    profile.highlights.length === 0;

  const updateField = (field: TextProfileField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleTrainerTitle = (title: TrainerTitle) => {
    setForm((current) => {
      if (current.trainerTitles.includes(title)) {
        return {
          ...current,
          trainerTitles: current.trainerTitles.filter(
            (candidate) => candidate !== title,
          ),
        };
      }
      if (current.trainerTitles.length >= 3) return current;
      return {
        ...current,
        trainerTitles: [...current.trainerTitles, title],
      };
    });
  };

  const selectHighlightForSlot = (instanceID: string) => {
    if (editingHighlightSlot === null) return;
    setHighlightIds((current) => {
      const next = [...current, ...emptyHighlightSlots()].slice(0, 6);
      next[editingHighlightSlot] = instanceID;
      return next;
    });
    setEditingHighlightSlot(null);
  };

  const clearHighlightSlot = () => {
    if (editingHighlightSlot === null) return;
    setHighlightIds((current) => {
      const selected = current.filter(
        (instanceID, index) => index !== editingHighlightSlot && instanceID,
      );
      return [...selected, ...emptyHighlightSlots()].slice(0, 6);
    });
    setEditingHighlightSlot(null);
  };

  const reorderHighlights = (fromIndex: number, toIndex: number) => {
    setHighlightIds((current) =>
      reorderTrainerShowcaseSlots(current, fromIndex, toIndex),
    );
  };

  const beginHighlightDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const instanceId = cardHighlights[index]?.instance_id;
    if (!instanceId || !event.isPrimary || event.button !== 0) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    suppressShowcaseClick.current = false;
    showcasePointerDrag.current = {
      pointerId: event.pointerId,
      currentIndex: index,
      instanceId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
      activated: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveHighlightDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const drag = showcasePointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.activated) {
      const distance = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );
      if (distance < SHOWCASE_DRAG_THRESHOLD_PX) return;
      drag.activated = true;
      suppressShowcaseClick.current = true;
      setEditingHighlightSlot(null);
      setDraggingHighlightSlot(drag.currentIndex);
    }

    event.preventDefault();
    setShowcaseDragPreview({
      instanceId: drag.instanceId,
      left: event.clientX - drag.offsetX,
      top: event.clientY - drag.offsetY,
      width: drag.width,
      height: drag.height,
    });
    const slot = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-showcase-slot]");
    const targetIndex = Number(slot?.dataset.showcaseSlot);
    if (!Number.isInteger(targetIndex)) return;

    const selectedCount = highlightIds.filter(Boolean).length;
    const destinationIndex = Math.min(
      targetIndex,
      Math.max(0, selectedCount - 1),
    );
    if (destinationIndex === drag.currentIndex) return;

    reorderHighlights(drag.currentIndex, destinationIndex);
    drag.currentIndex = destinationIndex;
    setDraggingHighlightSlot(destinationIndex);
  };

  const finishHighlightDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const drag = showcasePointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    showcasePointerDrag.current = null;
    setDraggingHighlightSlot(null);
    setShowcaseDragPreview(null);

    if (drag.activated) {
      window.setTimeout(() => {
        suppressShowcaseClick.current = false;
      }, 0);
    }
  };

  const moveHighlightWithKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!event.altKey) return;
    const direction =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : 0;
    if (!direction) return;

    const selectedCount = highlightIds.filter(Boolean).length;
    const destinationIndex = Math.max(
      0,
      Math.min(index + direction, selectedCount - 1),
    );
    if (destinationIndex === index) return;

    event.preventDefault();
    setEditingHighlightSlot(null);
    reorderHighlights(index, destinationIndex);
  };

  const toggleEditing = () => {
    if (editing && profile) {
      setForm(profileToForm(profile));
      setHighlightIds(
        normalizeTrainerShowcaseSlots(
          profile.highlights.map((entry) => entry.instance_id || ""),
        ),
      );
    }
    setEditingHighlightSlot(null);
    setDraggingHighlightSlot(null);
    setShowcaseDragPreview(null);
    showcasePointerDrag.current = null;
    setEditing((value) => !value);
  };

  const saveProfile = async () => {
    if (!authUser || !profile) return;
    setSaving(true);
    try {
      const normalizedTrainerCode = form.trainerCode.replace(/\s+/g, "");
      const authChanged =
        form.pokemonGoName !== (authUser.pokemonGoName ?? "") ||
        normalizedTrainerCode !== (authUser.trainerCode ?? "") ||
        form.location !== (authUser.location ?? "");

      if (authChanged) {
        const authResult = await updateUserDetails(authUser.user_id, {
          pokemonGoName: form.pokemonGoName,
          trainerCode: normalizedTrainerCode,
          location: form.location,
        });
        if (!authResult.success) {
          throw new Error(
            typeof authResult.error === "string"
              ? authResult.error
              : "Could not update account identity.",
          );
        }
      }

      const request: UpdateTrainerProfileRequest = {
        trainer_titles: form.trainerTitles,
        pokemonGoName: form.pokemonGoName,
        trainer_code: normalizedTrainerCode,
        team: form.team,
        location: form.location,
        trainer_level: form.trainerLevel
          ? Number(form.trainerLevel)
          : undefined,
        total_xp: form.totalXp ? Number(form.totalXp) : undefined,
        pogo_started_on: form.startedOn || undefined,
        highlight_instance_ids: highlightIds.filter(Boolean),
      };
      await updateTrainerProfile(request);
      feedback.success("Profile updated");
      setEditingHighlightSlot(null);
      setShowcaseDragPreview(null);
      setEditing(false);
      await loadProfile();
    } catch (saveError) {
      feedback.error(
        saveError instanceof Error
          ? saveError.message
          : "Could not update profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const runRelationshipAction = async () => {
    if (!profile) return;
    try {
      switch (profile.viewer.relationship) {
        case "none":
          await sendFriendRequest(profile.user.username);
          feedback.success("Friend request sent");
          break;
        case "incoming":
          await acceptFriendRequest(profile.viewer.friendship_id || "");
          feedback.success("Friend request accepted");
          break;
        case "outgoing":
          await deleteFriendRequest(profile.viewer.friendship_id || "");
          feedback.info("Friend request canceled");
          break;
        case "friend": {
          const shouldRemove = await confirm(
            `Remove ${profile.user.username} from your friends?`,
          );
          if (!shouldRemove) return;
          await removeFriend(profile.user.user_id);
          feedback.info("Friend removed");
          break;
        }
        default:
          return;
      }
      await queryClient.invalidateQueries({ queryKey: socialQueryKeys.friends });
      await loadProfile();
    } catch (relationshipError) {
      feedback.error(
        relationshipError instanceof Error
          ? relationshipError.message
          : "Could not update friendship.",
      );
    }
  };

  const handleBlock = async () => {
    if (!profile) return;
    const shouldBlock = await confirm(
      `Block ${profile.user.username}? Existing friendship and requests will be removed.`,
    );
    if (!shouldBlock) return;
    try {
      await blockTrainer(profile.user.user_id);
      await queryClient.invalidateQueries({ queryKey: socialQueryKeys.friends });
      await queryClient.invalidateQueries({
        queryKey: socialQueryKeys.profile(profile.user.username),
      });
      feedback.info("Trainer blocked");
      navigate("/profile/friends", {
        state: { contextBackTo: currentProfilePath },
      });
    } catch (blockError) {
      feedback.error(
        blockError instanceof Error
          ? blockError.message
          : "Could not block trainer.",
      );
    }
  };

  const relationshipButton = () => {
    if (!profile || isOwner || !authUser) return null;
    const { relationship } = profile.viewer;
    const contentByRelationship: Partial<
      Record<
        TrainerProfile<PokemonInstance>["viewer"]["relationship"],
        [React.ReactNode, string]
      >
    > = {
      none: [<FaUserPlus key="icon" />, "Add friend"],
      incoming: [<FaUserCheck key="icon" />, "Accept request"],
      outgoing: [<FaUserClock key="icon" />, "Request sent"],
      friend: [<FaCheck key="icon" />, "Friends"],
    };
    const content = contentByRelationship[relationship];
    if (!content) return null;

    return (
      <button
        type="button"
        className={`trainer-button ${
          relationship === "outgoing" || relationship === "friend"
            ? "trainer-button-secondary"
            : "trainer-button-primary"
        }`}
        onClick={() => void runRelationshipAction()}
      >
        {content}
      </button>
    );
  };

  return (
    <TrainerPageShell
      workspace="profile"
      eyebrow={isOwner ? "Your trainer card" : "Trainer profile"}
      title={profile?.user.username || username || "Profile"}
      actions={
        isOwner && profile ? (
          !editing ? (
            <button
              type="button"
              className="trainer-button trainer-button-secondary"
              onClick={toggleEditing}
            >
              <FaEdit />
              Edit
            </button>
          ) : null
        ) : (
          relationshipButton()
        )
      }
    >
      {loading ? (
        <div className="trainer-status">Loading trainer profile...</div>
      ) : null}
      {error ? (
        <div className="trainer-status trainer-status-error">{error}</div>
      ) : null}

      {!loading && profile ? (
        <>
          <section
            className={`trainer-profile-card trainer-team-${cardTeam} ${
              editing ? "trainer-profile-card-editing" : ""
            }`}
            aria-label={`${profile.user.username}'s trainer card`}
          >
            <aside className="trainer-card-identity">
              <span className="trainer-card-label">Trainer card</span>
              <div className="trainer-card-portrait">
                <div className="trainer-card-monogram" aria-hidden="true">
                  {profile.user.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="trainer-card-level">
                  <span>Level</span>
                  {editing ? (
                    <input
                      type="number"
                      min="1"
                      max="80"
                      aria-label="Trainer level"
                      value={form.trainerLevel}
                      onChange={(event) =>
                        updateField("trainerLevel", event.target.value)
                      }
                    />
                  ) : (
                    <strong>{profile.user.trainer_level || "-"}</strong>
                  )}
                </div>
              </div>
              <div className="trainer-card-name">
                {editing ? (
                  <input
                    className="trainer-card-edit-input"
                    aria-label="Pokemon GO name"
                    placeholder={profile.user.username}
                    value={form.pokemonGoName}
                    onChange={(event) =>
                      updateField("pokemonGoName", event.target.value)
                    }
                  />
                ) : (
                  <h2>
                    {profile.user.pokemonGoName || profile.user.username}
                  </h2>
                )}
                <span>@{profile.user.username}</span>
              </div>
              <div className="trainer-card-team">
                {editing ? (
                  <>
                    <select
                      aria-label="Team"
                      value={form.team}
                      onChange={(event) =>
                        updateField("team", event.target.value)
                      }
                    >
                      <option value="">Unaffiliated</option>
                      <option value="Mystic">Mystic</option>
                      <option value="Valor">Valor</option>
                      <option value="Instinct">Instinct</option>
                    </select>
                    <label>
                      <span>Total XP</span>
                      <input
                        type="number"
                        min="0"
                        aria-label="Total XP"
                        value={form.totalXp}
                        onChange={(event) =>
                          updateField("totalXp", event.target.value)
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <span>{profile.user.team || "Unaffiliated"}</span>
                    <strong>
                      {typeof profile.user.total_xp === "number"
                        ? `${formatNumber(profile.user.total_xp)} XP`
                        : "XP not shared"}
                    </strong>
                  </>
                )}
              </div>
              <div
                className="trainer-card-level-track"
                role="progressbar"
                aria-label={
                  cardTrainerLevel
                    ? `Trainer level ${cardTrainerLevel}`
                    : "Trainer level not shared"
                }
                aria-valuemin={0}
                aria-valuemax={50}
                aria-valuenow={cardTrainerLevel || 0}
              >
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((cardTrainerLevel || 0) / 80) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
            </aside>

            <div className="trainer-card-body">
              <header className="trainer-card-heading">
                <div>
                  <span>Pokémon Go Nexus</span>
                  <h2>Trainer card</h2>
                </div>
                <div className="trainer-card-number">
                  <span>Member since</span>
                  <strong>{formatDate(profile.user.app_joined_at)}</strong>
                </div>
              </header>

              <div
                className="trainer-card-highlights"
                aria-label="Featured Pokemon"
              >
                {Array.from(
                  { length: TRAINER_SHOWCASE_SLOT_COUNT },
                  (_, index) => {
                    const instance = cardHighlights[index];
                    if (editing) {
                      const name = instance
                        ? instance.nickname ||
                          variantByID.get(instance.variant_id)
                            ?.species_name ||
                          `Pokemon #${instance.pokemon_id}`
                        : null;
                      return (
                        <button
                          type="button"
                          className={`trainer-card-highlight trainer-card-highlight-editable ${
                            editingHighlightSlot === index ? "active" : ""
                          } ${
                            draggingHighlightSlot === index
                              ? "dragging"
                              : ""
                          } ${
                            instance
                              ? ""
                              : "trainer-card-highlight-empty"
                          }`}
                          key={`edit-highlight-${index + 1}`}
                          data-showcase-slot={index}
                          aria-label={
                            name
                              ? `Change featured Pokemon in slot ${index + 1}, currently ${name}`
                              : `Choose featured Pokemon for slot ${index + 1}`
                          }
                          aria-pressed={editingHighlightSlot === index}
                          aria-keyshortcuts={
                            instance
                              ? "Alt+ArrowLeft Alt+ArrowRight"
                              : undefined
                          }
                          title={
                            instance
                              ? "Drag to reorder; click to replace"
                              : "Click to choose a Pokemon"
                          }
                          onClick={() => {
                            if (suppressShowcaseClick.current) {
                              suppressShowcaseClick.current = false;
                              return;
                            }
                            setEditingHighlightSlot(index);
                          }}
                          onKeyDown={(event) =>
                            moveHighlightWithKeyboard(event, index)
                          }
                          onPointerDown={(event) =>
                            beginHighlightDrag(event, index)
                          }
                          onPointerMove={moveHighlightDrag}
                          onPointerUp={finishHighlightDrag}
                          onPointerCancel={finishHighlightDrag}
                        >
                          {instance ? (
                            <HighlightCardContent
                              instance={instance}
                              variant={variantByID.get(
                                instance.variant_id,
                              )}
                            />
                          ) : (
                            <>
                              <FaStar aria-hidden="true" />
                              <span>Choose Pokemon</span>
                            </>
                          )}
                          <span className="trainer-card-highlight-edit-cue">
                            {instance ? (
                              <FaGripVertical aria-hidden="true" />
                            ) : (
                              <FaEdit aria-hidden="true" />
                            )}
                            Slot {index + 1}
                          </span>
                        </button>
                      );
                    }
                    return instance ? (
                      <article
                        key={
                          instance.instance_id ||
                          `${instance.variant_id}-${index}`
                        }
                        className="trainer-card-highlight"
                      >
                        <HighlightCardContent
                          instance={instance}
                          variant={variantByID.get(instance.variant_id)}
                        />
                      </article>
                    ) : (
                      <div
                        className="trainer-card-highlight trainer-card-highlight-empty"
                        key={`empty-highlight-${index + 1}`}
                        aria-label={`Empty featured Pokemon slot ${index + 1}`}
                      >
                        <FaStar aria-hidden="true" />
                        <span>Open slot</span>
                      </div>
                    );
                  },
                )}
              </div>

              {editing && editingHighlightSlot !== null ? (
                <div className="trainer-card-showcase-editor">
                  <TrainerShowcasePicker
                    candidates={highlightCandidates}
                    selectedIds={highlightIds}
                    slotIndex={editingHighlightSlot}
                    variantById={variantByID}
                    onSelect={selectHighlightForSlot}
                    onClear={clearHighlightSlot}
                    onClose={() => setEditingHighlightSlot(null)}
                  />
                </div>
              ) : null}

              <dl className="trainer-card-facts">
                <div>
                  <FaCalendarAlt aria-hidden="true" />
                  <dt>Started</dt>
                  <dd>
                    {editing ? (
                      <input
                        type="date"
                        aria-label="Started playing"
                        value={form.startedOn}
                        onChange={(event) =>
                          updateField("startedOn", event.target.value)
                        }
                      />
                    ) : (
                      formatCalendarDate(profile.user.pogo_started_on)
                    )}
                  </dd>
                </div>
                <div>
                  <FaMapMarkerAlt aria-hidden="true" />
                  <dt>Location</dt>
                  <dd>
                    {editing ? (
                      <input
                        aria-label="Location"
                        value={form.location}
                        onChange={(event) =>
                          updateField("location", event.target.value)
                        }
                      />
                    ) : (
                      profile.location || "Not shared"
                    )}
                  </dd>
                </div>
                <div>
                  <FaIdCard aria-hidden="true" />
                  <dt>Trainer code</dt>
                  <dd>
                    {editing ? (
                      <input
                        inputMode="numeric"
                        maxLength={14}
                        aria-label="Trainer code"
                        value={form.trainerCode}
                        onChange={(event) =>
                          updateField("trainerCode", event.target.value)
                        }
                      />
                    ) : (
                      formatTrainerCode(profile.trainer_code)
                    )}
                  </dd>
                </div>
              </dl>

              <div
                className="trainer-card-collection"
                aria-label="Collection summary"
              >
                {([
                  {
                    label: "Registered",
                    value: profile.stats.registered,
                    visual: { mask: "/images/kanto_search.png" },
                  },
                  {
                    label: "Caught",
                    value: profile.stats.caught,
                    visual: { mask: "/images/pokeball-solid-mask.svg" },
                    filter: "Caught",
                  },
                  {
                    label: "For trade",
                    value: profile.stats.for_trade,
                    visual: { mask: "/images/pogo_trade_icon.png" },
                    filter: "Trade",
                  },
                  {
                    label: "Wanted",
                    value: profile.stats.wanted,
                    visual: { icon: FaHeart },
                    filter: "Wanted",
                  },
                  {
                    label: "Favorites",
                    value: profile.stats.favorites,
                    visual: { icon: FaStar },
                    filter: "Favorites",
                  },
                ] as TrainerCollectionItem[]).map(
                  ({ label, value, visual, filter }) => {
                    const canOpenCollection =
                      filter !== undefined &&
                      profile.viewer.can_view_collection &&
                      !editing;
                    const content = (
                      <>
                        <TrainerCollectionIcon
                          label={label}
                          visual={visual}
                        />
                        <span className="trainer-card-collection-label">
                          {label}
                        </span>
                        <strong className="trainer-card-collection-count">
                          {formatNumber(value)}
                        </strong>
                      </>
                    );

                    return canOpenCollection && filter ? (
                      <button
                        type="button"
                        className="trainer-card-collection-item trainer-card-collection-link"
                        key={label}
                        aria-label={`View ${
                          isOwner
                            ? "your"
                            : `${profile.user.username}'s`
                        } ${label.toLowerCase()} Pokemon`}
                        onClick={() =>
                          navigate(
                            buildPokemonCatalogPath({
                              username: isOwner
                                ? undefined
                                : profile.user.username,
                              filter,
                            }),
                            {
                              state: {
                                contextBackTo: currentProfilePath,
                              },
                            },
                          )
                        }
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        className="trainer-card-collection-item"
                        key={label}
                      >
                        {content}
                      </div>
                    );
                  },
                )}
              </div>

              <footer className="trainer-card-footer">
                <div className="trainer-card-titles">
                  <div className="trainer-card-titles-heading">
                    <span>Play styles</span>
                    {editing ? (
                      <small>{form.trainerTitles.length}/3 selected</small>
                    ) : null}
                  </div>
                  {editing ? (
                    <div
                      className="trainer-title-picker"
                      role="group"
                      aria-label="Trainer titles"
                    >
                      {TRAINER_TITLE_OPTIONS.map((option) => {
                        const selected = form.trainerTitles.includes(
                          option.id,
                        );
                        return (
                          <button
                            type="button"
                            className={`trainer-title-choice ${
                              selected ? "selected" : ""
                            }`}
                            key={option.id}
                            aria-pressed={selected}
                            aria-label={`${option.label}. ${option.description}`}
                            title={option.description}
                            disabled={
                              !selected &&
                              form.trainerTitles.length >= 3
                            }
                            onClick={() =>
                              toggleTrainerTitle(option.id)
                            }
                          >
                            <TrainerTitleVisual title={option.id} />
                            <strong>{option.label}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="trainer-title-list"
                      aria-label="Play styles"
                    >
                      {(profile.trainer_titles ?? []).length > 0 ? (
                        (profile.trainer_titles ?? []).map((title) => {
                          const option = trainerTitleOptionByID.get(title);
                          if (!option) return null;
                          return (
                            <span
                              className="trainer-title-badge"
                              key={title}
                            >
                              <TrainerTitleVisual title={title} />
                              {option.label}
                            </span>
                          );
                        })
                      ) : (
                        <span className="trainer-title-empty">
                          No play styles selected
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="trainer-profile-commands">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="trainer-button trainer-button-secondary"
                        onClick={toggleEditing}
                      >
                        <FaTimes />
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="trainer-button trainer-button-primary"
                        disabled={saving}
                        onClick={() => void saveProfile()}
                      >
                        <FaCheck />
                        {saving ? "Saving..." : "Save profile"}
                      </button>
                    </>
                  ) : profile.viewer.can_view_collection ? (
                    <button
                      type="button"
                      className="trainer-button trainer-button-primary"
                      onClick={() =>
                        navigate(
                          isOwner
                            ? "/pokemon"
                            : `/pokemon/${encodeURIComponent(profile.user.username)}`,
                          { state: { contextBackTo: currentProfilePath } },
                        )
                      }
                    >
                      <FaExchangeAlt />
                      View Pokemon
                    </button>
                  ) : null}
                  {!editing && !isOwner && authUser ? (
                    <button
                      type="button"
                      className="trainer-icon-button trainer-danger-icon"
                      aria-label="Block trainer"
                      title="Block trainer"
                      onClick={() => void handleBlock()}
                    >
                      <FaBan />
                    </button>
                  ) : null}
                </div>
              </footer>

              {needsProfileSetup && !editing ? (
                <div className="trainer-card-setup">
                  <div>
                    <span>Start here</span>
                    <h2>Make this trainer profile yours</h2>
                    <p>
                      Add your trainer details and choose Pokemon from your
                      collection to feature.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="trainer-button trainer-button-primary"
                    onClick={toggleEditing}
                  >
                    <FaEdit />
                    Customize profile
                  </button>
                </div>
              ) : null}
            </div>
          </section>
          {editing &&
          showcaseDragPreview &&
          draggedHighlight &&
          typeof document !== "undefined"
            ? createPortal(
                <div
                  className={`trainer-card-highlight trainer-card-highlight-drag-preview trainer-team-${cardTeam}`}
                  style={{
                    left: showcaseDragPreview.left,
                    top: showcaseDragPreview.top,
                    width: showcaseDragPreview.width,
                    height: showcaseDragPreview.height,
                  }}
                  aria-hidden="true"
                >
                  <HighlightCardContent
                    instance={draggedHighlight}
                    variant={variantByID.get(
                      draggedHighlight.variant_id,
                    )}
                  />
                  <span className="trainer-card-highlight-edit-cue">
                    <FaGripVertical aria-hidden="true" />
                    Moving
                  </span>
                </div>,
                document.body,
              )
            : null}
        </>
      ) : null}
    </TrainerPageShell>
  );
};

export default Profile;

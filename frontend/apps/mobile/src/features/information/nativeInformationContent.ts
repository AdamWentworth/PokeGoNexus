export type NativeInformationLink = {
  description?: string;
  label: string;
  path: string;
  primary?: boolean;
};

export type NativeInformationSection = {
  bullets?: string[];
  category?: string;
  detail?: string;
  id: string;
  links?: NativeInformationLink[];
  paragraphs?: string[];
  title: string;
};

export type NativeInformationPage = {
  eyebrow: string;
  intro: string;
  sections: NativeInformationSection[];
  slug: NativeInformationSlug;
  title: string;
  updated?: string;
};

export type NativeInformationSlug =
  | 'about'
  | 'data-deletion'
  | 'faq'
  | 'getting-started'
  | 'help'
  | 'privacy'
  | 'safety'
  | 'terms';

const GETTING_STARTED: NativeInformationPage = {
  slug: 'getting-started',
  eyebrow: 'POKÉMON GO NEXUS GUIDE',
  title: 'Your first useful trade, step by step.',
  intro: 'Follow the same order you will use in the app, from one exact collection entry to a coordinated trade.',
  sections: [
    {
      id: 'collection', category: 'STEP 01', title: 'Start your collection',
      detail: 'Add a Pokémon you own before worrying about the rest of the system.',
      bullets: ['Search for the species and exact variant.', 'Save it as Caught and add details only if they matter to you.', 'Use Favorites or custom tags to keep large collections manageable.'],
      links: [{ label: 'Open Pokémon', path: '/pokemon', primary: true }],
    },
    {
      id: 'wanted', category: 'STEP 02', title: 'Create a Wanted entry',
      detail: 'Wanted Pokémon are wishlist records, not missing caught instances.',
      bullets: ['Choose Wanted when adding the Pokémon.', 'Mark it Most Wanted when it deserves extra priority.', 'Set friendship, lucky, size, gender, or move conditions only when required.'],
      links: [{ label: 'Build your wishlist', path: '/pokemon?filter=wanted' }],
    },
    {
      id: 'for-trade', category: 'STEP 03', title: 'List something For Trade',
      detail: 'A For Trade listing remains part of your caught collection until a trade completes.',
      bullets: ['Choose a caught Pokémon that is eligible to trade.', 'Favorites and Lucky Pokémon remain protected from being listed.', 'Use Trade Preferences to choose what you would accept in return.'],
      links: [{ label: 'Open trade preferences', path: '/trades?section=preferences' }],
    },
    {
      id: 'discovery', category: 'STEP 04', title: 'Find a trainer or listing',
      detail: 'Search can be broad or exact; add only the filters that improve the result.',
      bullets: ['Search Pokémon by ownership, variant, location, and trade details.', 'Search trainers by either Nexus username or Pokémon GO name.', 'Open a listing to review the trainer’s actual public catalog context.'],
      links: [{ label: 'Explore search', path: '/search' }],
    },
    {
      id: 'proposal', category: 'STEP 05', title: 'Propose and coordinate',
      detail: 'Review the exact exchange, then coordinate an accepted trade outside the app.',
      bullets: ['Your Pokémon always appears on the left and theirs on the right.', 'Set the friendship level and review remote, Lucky, special-trade, and Stardust information.', 'The users service validates both participants and Pokémon before accepting the proposal.', 'After acceptance, use the opted-in Trainer Code and Campfire, Discord, or another agreed service to arrange the in-game trade.'],
      links: [{ label: 'View trade activity', path: '/trades?section=activity' }],
    },
    {
      id: 'sharing', category: 'STEP 06', title: 'Share beyond Pokémon Go Nexus',
      detail: 'Meet trainers where they already are without rebuilding your trade list by hand.',
      bullets: ['Generate a polished image containing your offers and wishlist.', 'Publish a live Trade Board connected to your listings.', 'Keep private collection and profile details out of the public board.'],
      links: [{ label: 'Create a Trade Board', path: '/trade-board' }],
    },
  ],
};

const FAQ: NativeInformationPage = {
  slug: 'faq',
  eyebrow: 'TRAINER SUPPORT',
  title: 'Frequently asked questions',
  intro: 'Clear answers about accounts, collections, trading, discovery, privacy, and the rules Pokémon Go Nexus enforces.',
  sections: [
    { id: 'same-email-account', category: 'ACCOUNT', title: 'Does the same email always open the same account?', paragraphs: ['Yes. When a supported OAuth provider returns the same verified email as an existing email/password or OAuth account, logging in uses that existing Pokémon Go Nexus account and its collection data.', 'If you choose Sign up with an email that already belongs to an account, registration is refused and you are directed to log in instead. This prevents a second account from being created for the same email.'] },
    { id: 'signup-versus-login', category: 'ACCOUNT', title: 'Should I choose Sign up or Log in with Google, Discord, or Facebook?', paragraphs: ['Use Sign up only when creating a new Pokémon Go Nexus account. Use Log in when the email already has an account, even if you originally registered with a different supported login method.', 'OAuth may temporarily open a system browser or provider app. That handoff is controlled partly by your device and the provider; Pokémon Go Nexus returns you to the authenticated experience after a successful callback whenever the browser permits it.'] },
    { id: 'password-reset', category: 'ACCOUNT', title: 'How do I reset my password?', paragraphs: ['Choose Reset Password on the login screen and submit the email address on your account. The reset email contains a time-limited link that opens the secure password form.', 'For privacy, the request screen does not confirm whether a particular email is registered. OAuth-only accounts can continue using their connected provider.'] },
    { id: 'delete-account', category: 'ACCOUNT', title: 'How do I delete my account and personal data?', paragraphs: ['Signed-in users can begin account deletion from account settings. The data-deletion guide explains the scope and confirmation process before anything is removed.'], links: [{ label: 'Read the data-deletion guide', path: '/data-deletion' }] },
    { id: 'collection-statuses', category: 'COLLECTION', title: 'What do Caught, For Trade, Wanted, and Most Wanted mean?', paragraphs: ['Caught is your owned inventory. For Trade is an owned, tradeable Pokémon you are offering. Wanted is a wishlist entry rather than an owned copy, and Most Wanted is a priority marker within that wishlist.', 'A Wanted entry can describe the exact form, costume, moves, size class, background, friendship, and other conditions you care about without pretending that you already own it.'] },
    { id: 'favorites-and-trade', category: 'COLLECTION', title: 'Can a Favorite Pokémon also be listed For Trade?', paragraphs: ['No. Favorites and For Trade are intentionally mutually exclusive. The organizer and instance editor prevent a Favorite from being offered and prevent a For Trade Pokémon from being marked Favorite.', 'Remove the existing status first if your intent changes. This guard helps avoid offering a Pokémon you meant to protect.'] },
    { id: 'wanted-becomes-caught', category: 'COLLECTION', title: 'What happens when I obtain a Pokémon from my Wanted list?', paragraphs: ['You can move the Wanted entry into Caught. Pokémon Go Nexus preserves the exact variant details that remain applicable, removes it from the wishlist context, and lets you organize the new owned instance with inventory tags.', 'A caught Pokémon can also be copied into Wanted when you want another copy; the owned instance and wishlist entry remain separate records with different purposes.'] },
    { id: 'custom-tags', category: 'COLLECTION', title: 'How do custom tags work?', paragraphs: ['Create color-coded tags from the Tags view or Pokémon Organizer, then apply them while creating Pokémon or to existing instances. Inventory tags organize Caught Pokémon; wishlist tags organize Wanted Pokémon.', 'Default system groups such as All Caught, Favorites, For Trade, All Wanted, and Most Wanted keep their built-in rules. You can reorder the combined tag cards to fit your own workflow.'] },
    { id: 'collection-sync', category: 'COLLECTION', title: 'Why can collection changes feel immediate before synchronization finishes?', paragraphs: ['The collection is cached locally so large or repeated Pokémon updates do not hold the interface hostage. Eligible Pokémon changes can be batched and synchronized through the receiver in the background.', 'Trade commands are different: proposals and state changes require a connection and are not considered successful until the server commits them.'] },
    { id: 'trade-preferences', category: 'TRADING', title: 'What are Trade Preferences and Wanted Conditions?', paragraphs: ['For Trade preferences describe which Wanted Pokémon you would accept for a particular Pokémon you own. Wanted conditions describe which of another trainer’s For Trade Pokémon fit a particular wishlist entry.', 'Manage those reusable rules in Trade Preferences. When viewing another trainer’s catalog, the compatible targets lead directly into a proposal for exact owned instances.'] },
    { id: 'propose-trade', category: 'TRADING', title: 'How do I propose a trade?', paragraphs: ['Open another trainer’s For Trade or Wanted listing, choose a compatible target, select the exact Pokémon you own when needed, and review the exchange. Your Pokémon is always shown on the left and theirs on the right in the final proposal screen.', 'The server rechecks both participants, ownership, friendship and privacy rules, active-trade conflicts, and the current Pokémon state before accepting the proposal.'] },
    { id: 'remote-trades', category: 'TRADING', title: 'What does the fifth friendship heart mean?', paragraphs: ['Five hearts represents Forever Friends and makes a remote trade available. Remote eligibility is separate from Lucky Friends: a five-heart remote trade may be lucky or non-lucky depending on the trainers’ actual Lucky Friends state and preferences.', 'Lucky Friends can apply at four hearts or higher. The proposal review shows the remote and lucky indicators independently so one is never implied by the other.'] },
    { id: 'lucky-pokemon', category: 'TRADING', title: 'Why can’t I list a Lucky Pokémon For Trade?', paragraphs: ['Pokémon that have already become Lucky cannot be traded again in Pokémon GO. Pokémon Go Nexus therefore excludes Lucky instances from eligible offers and blocks attempts to convert them into For Trade entries.'] },
    { id: 'trade-cost', category: 'TRADING', title: 'How are Stardust cost and special-trade warnings handled?', paragraphs: ['The proposal review estimates the Stardust cost from the selected Pokémon, registration state, friendship level, and special-trade rules. It also labels special, remote, and requested-lucky conditions before you send anything.', 'The estimate is planning guidance. Pokémon GO remains authoritative at the moment the trainers perform the real in-game trade.'] },
    { id: 'trade-state', category: 'TRADING', title: 'Why might a trade action be rejected after the screen was already open?', paragraphs: ['Trade state is server-authoritative and can change on another device or for the other participant. A stale proposal, ownership change, block, privacy change, or conflicting active trade can make an earlier screen invalid.', 'The app refreshes from the canonical server response rather than claiming success optimistically. Review the updated Trade Activity card before trying the next valid action.'] },
    { id: 'trade-communication', category: 'TRADING', title: 'How do trainers communicate and complete an accepted trade?', paragraphs: ['Pokémon Go Nexus does not include chat. After an offer is accepted, the Trade Activity screen can show only the Pokémon GO and coordination details that each participant chose to share for active accepted trades.', 'Add one another in Pokémon GO and coordinate through Campfire, Discord, or another agreed service. Campfire is the recommended default because it supports Niantic Friends and direct messages. Messaging, meetup arrangements, and the final exchange happen outside Pokémon Go Nexus and remain the trainers’ responsibility.'], links: [{ label: 'Review trade safety guidance', path: '/safety' }] },
    { id: 'search-matchmaker', category: 'DISCOVERY', title: 'What does Matchmaker change in Pokémon Search?', paragraphs: ['Normal Search finds listings that satisfy your selected Pokémon, ownership, variant, distance, and detail filters. Matchmaker additionally prioritizes reciprocal results where that trainer wants something compatible from your collection.', 'A match is a discovery hint, not a guaranteed proposal. The trade service validates the exact Pokémon and both accounts again when you submit.'] },
    { id: 'location-search', category: 'DISCOVERY', title: 'How is location used in Search?', paragraphs: ['Location and range filters help calculate nearby listings and distance summaries. Results are still limited by each account’s visibility, friendship, and blocking rules.', 'Only enable or save location information you are comfortable using for discovery, and review your profile privacy controls when those preferences change.'] },
    { id: 'friends-privacy-blocks', category: 'DISCOVERY', title: 'How do friends, privacy settings, and blocks affect discovery?', paragraphs: ['Friend relationships can permit additional profile or collection visibility and are ranked ahead where a matching workflow calls for it. Your account settings determine what other trainers may see.', 'Blocking prevents the blocked relationship from participating in social and trade discovery. Server-side checks enforce these rules again for sensitive actions.'] },
    { id: 'trade-board-sharing', category: 'DISCOVERY', title: 'What is a Trade Board?', paragraphs: ['A Trade Board turns selected For Trade and Wanted Pokémon into a polished image and shareable public page. It is designed for Discord, chats, social groups, and trainers who may not use Pokémon Go Nexus yet.', 'Treat exported images and public links as shareable content. Review the board before publishing it anywhere outside the app.'], links: [{ label: 'Open the Trade Board builder', path: '/trade-board' }] },
    { id: 'unofficial-app', category: 'DISCOVERY', title: 'Is Pokémon Go Nexus an official Pokémon GO service?', paragraphs: ['No. Pokémon Go Nexus is an independent community project and is not affiliated with or endorsed by Niantic, The Pokémon Company, Nintendo, or other rights holders.', 'Pokémon, Pokémon GO, related names, images, and trademarks belong to their respective owners.'], links: [{ label: 'Review the Terms of Service', path: '/terms' }] },
  ],
};

export const NATIVE_INFORMATION_PAGES: Record<NativeInformationSlug, NativeInformationPage> = {
  'getting-started': GETTING_STARTED,
  faq: FAQ,
  help: {
    slug: 'help', eyebrow: 'TRAINER RESOURCES', title: 'Help & information',
    intro: 'Find the right guide, understand how a tool works, or review account and privacy information. This directory is available whether you are signed in or not.',
    sections: [
      { id: 'start', title: 'Start using Pokémon Go Nexus', detail: 'Learn the collection-to-trade workflow in the same order you will use it.', links: [
        { label: 'Frequently asked questions', description: 'Quick answers about accounts, collections, tags, trades, Search, privacy, and sharing.', path: '/faq' },
        { label: 'Getting started', description: 'Build a collection, create Wanted and For Trade entries, find a match, and propose safely.', path: '/getting-started' },
      ] },
      { id: 'community', title: 'About and community', detail: 'Understand the project and review the expectations that support safer trainer interactions.', links: [
        { label: 'About Pokémon Go Nexus', description: 'Why the collection, discovery, and trade-planning tools belong in one trainer hub.', path: '/about' },
        { label: 'Trade safety & community guidelines', description: 'Protect your account, privacy, and comfort while coordinating with other trainers.', path: '/safety' },
      ] },
      { id: 'tools', title: 'Understand the trainer tools', detail: 'See what the app calculates, what each ranking answers, and where the limits are.', links: [
        { label: 'Raid methodology', description: 'How general strength, type rankings, boss counters, battle simulation, and raid metrics work.', path: '/raid/methodology' },
        { label: 'PvP methodology', description: 'How rankings, IV Rank, Team Builder, Battle Lab, and published source data fit together.', path: '/pvp/methodology' },
      ] },
      { id: 'account', title: 'Privacy and account information', detail: 'Review the policies that apply to your account and the data controls available to you.', links: [
        { label: 'Privacy policy', description: 'What information Pokémon Go Nexus collects, why it is used, and how it is protected.', path: '/privacy' },
        { label: 'Terms of service', description: 'The rules and responsibilities that apply when using Pokémon Go Nexus.', path: '/terms' },
        { label: 'Data deletion', description: 'How to remove your Pokémon Go Nexus account and associated personal data.', path: '/data-deletion' },
      ] },
    ],
  },
  about: {
    slug: 'about', eyebrow: 'INDEPENDENT COMMUNITY PROJECT', title: 'About Pokémon Go Nexus',
    intro: 'A trainer-focused collection, discovery, and trade-planning hub built around the details that make each Pokémon distinct.',
    sections: [
      { id: 'purpose', category: 'WHY IT EXISTS', title: 'Trading starts with understanding what everyone actually has.', paragraphs: ['A Pokémon name alone rarely describes a useful trade. Pokémon Go Nexus connects exact collection records, personal Wanted and For Trade preferences, trainer discovery, and an explicit proposal workflow so both sides can understand an exchange before coordinating it in Pokémon GO.', 'The goal is not to replace the game. It is to make the planning around collecting, finding, and trading far more organized.'] },
      { id: 'exact', category: 'PRODUCT PRINCIPLES', title: 'Exact collections', paragraphs: ['Forms, costumes, backgrounds, moves, sizes, tags, and ownership states stay attached to the Pokémon they describe.'] },
      { id: 'reciprocal', category: 'PRODUCT PRINCIPLES', title: 'Reciprocal discovery', paragraphs: ['Search is designed to find a trainer who has what you want and may also want something you can actually offer.'] },
      { id: 'authoritative', category: 'PRODUCT PRINCIPLES', title: 'Authoritative trade workflows', paragraphs: ['Trade proposals and state changes are validated by the server instead of being treated as successful only in one browser.'] },
      { id: 'collection', category: 'THE TRAINER HUB', title: 'Collection', detail: 'Catalog exact Pokémon and organize them with flexible tags.', links: [{ label: 'Open Collection', path: '/pokemon' }] },
      { id: 'discovery', category: 'THE TRAINER HUB', title: 'Discovery', detail: 'Find trainers, listings, and reciprocal trade possibilities.', links: [{ label: 'Open Discovery', path: '/search' }] },
      { id: 'trading', category: 'THE TRAINER HUB', title: 'Trading', detail: 'Set preferences, propose exchanges, and follow their state.', links: [{ label: 'Open Trading', path: '/trades' }] },
      { id: 'network', category: 'THE TRAINER HUB', title: 'Trainer network', detail: 'Manage profiles, friends, visibility, and blocked trainers.', links: [{ label: 'Open Trainer network', path: '/profile/friends' }] },
      { id: 'independent', category: 'INDEPENDENT BY DESIGN', title: 'A community project', paragraphs: ['Pokémon Go Nexus is an independent community project. It is not affiliated with or endorsed by Niantic, The Pokémon Company, Nintendo, or other rights holders. Pokémon, Pokémon GO, related names, images, and trademarks belong to their respective owners.'], links: [{ label: 'Getting Started', path: '/getting-started', primary: true }, { label: 'Read the FAQ', path: '/faq' }] },
    ],
  },
  safety: {
    slug: 'safety', eyebrow: 'TRAINER TRUST', title: 'Trade Safety & Community Guidelines',
    intro: 'Protect your account, personal information, and comfort while coordinating trades with other trainers.',
    sections: [
      { id: 'boundary', category: 'IMPORTANT', title: 'Pokémon Go Nexus plans the exchange; Pokémon GO performs it.', paragraphs: ['A listing, match, proposal, friendship setting, or cost estimate in this app is planning information. Always verify the final Pokémon, eligibility, trade cost, and outcome in Pokémon GO before confirming the real trade.'] },
      { id: 'exact', title: 'Confirm the exact exchange', bullets: ['Review both Pokémon, forms, costumes, and other meaningful details before agreeing.', 'Check the estimated Stardust and special-trade conditions, then confirm them again in Pokémon GO.'] },
      { id: 'account', title: 'Protect every account', bullets: ['Never share a password, provider login, verification code, recovery link, or device access.', 'Pokémon Go Nexus does not need your Pokémon GO login credentials to organize a trade.'] },
      { id: 'meet', title: 'Meet with care', bullets: ['For local trades, use a familiar public place and avoid sharing more location detail than necessary.', 'Tell someone where you are going when meeting an unfamiliar trainer, and leave if anything feels wrong.'] },
      { id: 'respect', title: 'Treat trainers respectfully', bullets: ['Keep listings accurate, communicate changes, and do not pressure another trainer to continue.', 'Harassment, impersonation, deceptive listings, and attempts to obtain money or credentials are not acceptable.'] },
      { id: 'coordinate', title: 'Coordinate outside the app carefully', bullets: ['Pokémon Go Nexus has no chat; accepted partners may share a Trainer Code and a preferred external method such as Campfire or Discord.', 'External messages are not moderated by Pokémon Go Nexus. Share only what is necessary, and use each service’s own privacy, reporting, and blocking tools.'] },
      { id: 'block', title: 'Use privacy and blocking controls', bullets: ['Limit profile, collection, trainer-code, and location visibility to the audience you are comfortable with.', 'Cancel the interaction and block a trainer when continued contact is unwanted or unsafe.'] },
      { id: 'changes', title: 'Stop when the details change', bullets: ['Do not continue when the offered Pokémon, cost, account, meeting place, or other terms differ unexpectedly.', 'Preserve relevant messages or screenshots if you may need to document harmful behavior elsewhere.'] },
      { id: 'can', category: 'KNOW THE BOUNDARY', title: 'Pokémon Go Nexus can help you', bullets: ['Describe exact collection and wishlist records.', 'Find compatible public listings and trainers.', 'Review proposals and track agreed workflow states.', 'Control visibility and block unwanted contact.'] },
      { id: 'cannot', category: 'KNOW THE BOUNDARY', title: 'Pokémon Go Nexus cannot guarantee', bullets: ['Another person’s identity, conduct, or availability.', 'That a stale listing still matches the trainer’s game account.', 'A Lucky result, exact Stardust cost, or successful in-game trade.', 'Safety outside the service or compliance with local rules.', 'Messages, conduct, or moderation on Campfire, Discord, or another external service.'] },
      { id: 'controls', category: 'YOUR CONTROLS', title: 'Review visibility and manage trainer access.', detail: 'Privacy settings and the blocked-trainer list remain available from your account.', links: [{ label: 'Privacy settings', path: '/settings', primary: true }, { label: 'Friends & blocked', path: '/profile/friends' }, { label: 'Terms of Service', path: '/terms' }] },
    ],
  },
  privacy: {
    slug: 'privacy', eyebrow: 'LEGAL', title: 'Privacy Policy', updated: 'July 28, 2026',
    intro: 'How Pokémon Go Nexus collects, uses, and protects application data.',
    sections: [
      { id: 'collect', title: 'What Pokémon Go Nexus collects', paragraphs: ['We collect the account information you provide, such as your email address, username, optional Pokémon GO trainer details, optional location, and the Pokémon collection, friendship, search, and trade information you choose to store or share through the service.', 'When you use Google, Discord, or Facebook to authenticate, we receive a provider account identifier and email address. We do not receive or store your password for those providers.'] },
      { id: 'use', title: 'How information is used', paragraphs: ['Information is used to authenticate your account, provide collection and trade features, show the profile and discovery information you elect to share, protect the service, diagnose errors, and improve Pokémon Go Nexus.'] },
      { id: 'sharing', title: 'Sharing and service providers', paragraphs: ['We do not sell personal information. Information is shared only as needed to operate the service, comply with law, prevent abuse, or provide features you request. Authentication providers process login information under their own privacy policies.'] },
      { id: 'retention', title: 'Retention, security, and your choices', paragraphs: ['Account information is retained while your account is active and for only as long afterward as reasonably required for security, backups, or legal obligations. You can edit optional profile and privacy settings or delete your account and associated application data from Account Security.'] },
    ],
  },
  terms: {
    slug: 'terms', eyebrow: 'LEGAL', title: 'Terms of Service', updated: 'July 28, 2026',
    intro: 'The rules and service boundaries that apply when using Pokémon Go Nexus.',
    sections: [
      { id: 'use', title: 'Using Pokémon Go Nexus', paragraphs: ['You may use Pokémon Go Nexus for lawful personal and community purposes. You are responsible for the accuracy of information you submit and for protecting access to your account.'] },
      { id: 'conduct', title: 'Community conduct', paragraphs: ['Do not misuse the service, impersonate others, harass users, attempt unauthorized access, interfere with service operation, automate abusive traffic, or use Pokémon Go Nexus to facilitate unlawful activity.'] },
      { id: 'availability', title: 'Availability and changes', paragraphs: ['Pokémon Go Nexus is provided on an as-available basis. Features may change, be interrupted, or be discontinued. We may restrict accounts that threaten users, data, or service integrity.'] },
      { id: 'third-party', title: 'Third-party services', paragraphs: ['Pokémon GO, Pokémon, Google, Discord, Facebook, and related marks belong to their respective owners. Pokémon Go Nexus is an independent community service and is not endorsed by Niantic, The Pokémon Company, Nintendo, or the login providers.'] },
    ],
  },
  'data-deletion': {
    slug: 'data-deletion', eyebrow: 'ACCOUNT HELP', title: 'User Data Deletion', updated: 'July 28, 2026',
    intro: 'Delete your Pokémon Go Nexus account and associated application data.',
    sections: [
      { id: 'delete', title: 'Delete your account in Pokémon Go Nexus', bullets: ['Sign in to the Pokémon Go Nexus account you want to delete.', 'Open Settings → Account Security.', 'Select Delete account and confirm the request.'], paragraphs: ['This removes the sign-in account and initiates deletion of associated Pokémon Go Nexus application data. Some limited records may remain temporarily in encrypted backups or where retention is required for security or law.'] },
      { id: 'signin', title: 'If you cannot sign in', paragraphs: ['Password-based accounts can use the password-reset option on the login screen. For Google, Discord, or Facebook accounts, sign in with the same provider and email address originally connected to Pokémon Go Nexus, then use the account-deletion steps above.'] },
      { id: 'facebook', title: 'Remove Facebook access', paragraphs: ["Removing Pokémon Go Nexus from Facebook's Apps and Websites settings stops future Facebook access. To delete information already stored by Pokémon Go Nexus, also complete one of the deletion methods above."] },
    ],
  },
};

export const isNativeInformationSlug = (value: string): value is NativeInformationSlug => (
  Object.prototype.hasOwnProperty.call(NATIVE_INFORMATION_PAGES, value)
);

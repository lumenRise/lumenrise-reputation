const SOCIAL_MAX_SCORE = 300;
const SOCIAL_PROFILE_WEIGHT = 0.25;
const SOCIAL_NETWORK_WEIGHT = 0.75;

const X_PROFILE_SIGNALS = [
  {
    key: 'account_age_days',
    metric: 'accountAgeDays',
    weight: 0.3,
    scale: 365,
  },
  { key: 'follower_count', metric: 'followerCount', weight: 0.4, scale: 500 },
  {
    key: 'reported_post_count',
    metric: 'reportedPostCount',
    weight: 0.3,
    scale: 500,
  },
] as const;

const X_PRIORITY_WEIGHTS = { A: 1.5, B: 1 } as const;
const X_CONNECTION_WEIGHTS = { following: 0.4, followed_by: 0.6 } as const;

const X_SOCIAL_CATEGORIES = [
  {
    key: 'stellar_ecosystem',
    weight: 0.45,
    accounts: [
      { name: 'Stellar', username: 'StellarOrg', priority: 'A' },
      { name: 'Build on Stellar', username: 'BuildOnStellar', priority: 'A' },
      { name: 'Justin Rice', username: 'jricetweets', priority: 'A' },
      { name: 'Tyler van der Hoeven', username: 'kalepail', priority: 'A' },
      { name: 'Tomer Weller', username: 'tomerweller', priority: 'A' },
      { name: 'Esteban Iglesias', username: 'esteblock_dev', priority: 'A' },
      { name: 'Leigh McCulloch', username: '___leigh___', priority: 'A' },
      { name: 'Anke Liu', username: 'anke_g_liu', priority: 'A' },
      { name: 'Denelle Dixon', username: 'DenelleDixon', priority: 'B' },
      { name: 'Jed McCaleb', username: 'JedMcCaleb', priority: 'B' },
      { name: 'James Bachini', username: 'james_bachini', priority: 'B' },
      { name: 'Gemma Dobbs', username: 'gwd2000', priority: 'B' },
    ],
  },
  {
    key: 'web3_builders',
    weight: 0.25,
    accounts: [
      { name: 'Vitalik Buterin', username: 'VitalikButerin', priority: 'A' },
      { name: 'Anatoly Yakovenko', username: 'aeyakovenko', priority: 'A' },
      { name: 'Jesse Pollak', username: 'jessepollak', priority: 'A' },
      { name: 'Hayden Adams', username: 'haydenzadams', priority: 'A' },
      { name: 'Stani Kulechov', username: 'StaniKulechov', priority: 'A' },
      { name: 'Mert Mumtaz', username: '0xMert_', priority: 'A' },
      { name: 'Gavin Wood', username: 'gavofyork', priority: 'A' },
      { name: 'Emin Gün Sirer', username: 'el33th4xor', priority: 'A' },
      { name: 'Sandeep Nailwal', username: 'sandeepnailwal', priority: 'B' },
      { name: 'Andre Cronje', username: 'AndreCronjeTech', priority: 'A' },
    ],
  },
  {
    key: 'crypto_ecosystem',
    weight: 0.15,
    accounts: [
      { name: 'Brian Armstrong', username: 'brian_armstrong', priority: 'B' },
      { name: 'Changpeng Zhao', username: 'cz_binance', priority: 'B' },
      { name: 'Balaji Srinivasan', username: 'balajis', priority: 'A' },
      { name: 'Chris Dixon', username: 'cdixon', priority: 'A' },
      { name: 'Marc Andreessen', username: 'pmarca', priority: 'B' },
      { name: 'Naval Ravikant', username: 'naval', priority: 'B' },
      { name: 'Charles Hoskinson', username: 'IOHK_Charles', priority: 'B' },
      { name: 'Justin Sun', username: 'justinsuntron', priority: 'B' },
      { name: 'Michael Saylor', username: 'saylor', priority: 'B' },
      { name: 'Arthur Hayes', username: 'CryptoHayes', priority: 'B' },
    ],
  },
  {
    key: 'research_defi_community',
    weight: 0.15,
    accounts: [
      { name: 'ZachXBT', username: 'zachxbt', priority: 'A' },
      { name: 'Hasu', username: 'hasufl', priority: 'A' },
      { name: 'Tarun Chitra', username: 'tarunchitra', priority: 'A' },
      { name: 'Anthony Sassano', username: 'sassal0x', priority: 'A' },
      { name: '6529', username: 'punk6529', priority: 'B' },
      { name: 'Cobie', username: 'cobie', priority: 'B' },
      { name: 'Andrew Kang', username: 'Rewkang', priority: 'B' },
      { name: 'Ansem', username: 'blknoiz06', priority: 'B' },
    ],
  },
] as const;

export {
  SOCIAL_MAX_SCORE,
  SOCIAL_PROFILE_WEIGHT,
  SOCIAL_NETWORK_WEIGHT,
  X_PROFILE_SIGNALS,
  X_PRIORITY_WEIGHTS,
  X_CONNECTION_WEIGHTS,
  X_SOCIAL_CATEGORIES,
};

import type { ReputationSignalRecord } from './model';

interface SocialSignalInput {
  key: string;
  rawValue: number;
  baseWeight: number;
  scale: number;
  normalization: 'diminishing_returns' | 'linear';
  observedAt: Date;
}

interface SocialScoreCalculation {
  score: number;
  signals: ReputationSignalRecord[];
}

export type { SocialScoreCalculation, SocialSignalInput };

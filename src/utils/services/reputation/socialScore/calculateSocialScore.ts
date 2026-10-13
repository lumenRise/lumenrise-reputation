import { round } from './round';
import { normalizeSocialSignal } from './normalizeSocialSignal';
import { SOCIAL_MAX_SCORE } from '../../../../constants/services/reputation/socialScore';
import type {
  SocialScoreCalculation,
  SocialSignalInput,
} from '../../../../types/reputation/socialScoring';

const calculateSocialScore = (inputs: SocialSignalInput[]): SocialScoreCalculation => {
  if (inputs.some((input) => !Number.isFinite(input.baseWeight) || input.baseWeight <= 0)) {
    throw new Error('Social signal weights must be positive');
  }

  const totalWeight = inputs.reduce((total, input) => total + input.baseWeight, 0);

  if (totalWeight <= 0) {
    throw new Error('Social score requires at least one weighted signal');
  }

  const signals = inputs.map((input) => {
    if (!Number.isFinite(input.rawValue) || input.rawValue < 0) {
      throw new Error('Social signal value must be finite and nonnegative');
    }

    if (!Number.isFinite(input.scale) || input.scale <= 0) {
      throw new Error('Social signal scale must be positive');
    }

    const normalizedScore =
      input.normalization === 'linear'
        ? round(100 * Math.min(input.rawValue / input.scale, 1), 4)
        : normalizeSocialSignal(input.rawValue, input.scale);

    const weight = input.baseWeight / totalWeight;

    const contribution = round(
      (normalizedScore / 100) * SOCIAL_MAX_SCORE * weight,
      4,
    );

    return {
      provider: 'x' as const,
      key: input.key,
      rawValue: input.rawValue,
      normalization: input.normalization,
      scale: input.scale,
      baseWeight: input.baseWeight,
      normalizedScore,
      weight,
      contribution,
      observedAt: input.observedAt,
    };
  });

  const score = round(
    signals.reduce((total, signal) => total + signal.contribution, 0),
    2,
  );

  return { score, signals };
};

export { calculateSocialScore };

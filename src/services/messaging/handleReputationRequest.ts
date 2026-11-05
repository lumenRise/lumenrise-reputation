import { Types } from 'mongoose';

import getSybilEvidence from '../sybil/getSybilEvidence';
import readSorobanEvidence from '../stellar/readSorobanEvidence';
import type { DomainRequest } from '../../types/messaging/domain';
import StellarActivityScan from '../../models/StellarActivityScan';
import { calculateStellarActivityScore } from '../stellar/activityScore';
import isValidStellarGAddress from '../../utils/stellar/isValidStellarGAddress';

const handleReputationRequest = async (request: DomainRequest): Promise<unknown> => {
  const { operation, parameters } = request;
  const { identity, network } = parameters;

  if (
    typeof identity !== 'string' ||
    !/^[a-f0-9]{24}$/i.test(identity) ||
    (network !== 'testnet' && network !== 'public')
  ) {
    throw new Error('Invalid reputation identity or network');
  }

  const identityId = new Types.ObjectId(identity);

  if (operation === 'stellar.score') {
    if (typeof parameters.scanId !== 'string' || !/^[a-f0-9]{24}$/i.test(parameters.scanId)) {
      throw new Error('Invalid Stellar scan identity');
    }

    const scan = await StellarActivityScan.findOne({
      _id: new Types.ObjectId(parameters.scanId),
      identity: identityId,
      network,
    });

    if (!scan) {
      throw new Error('Stellar activity scan was not found');
    }

    return calculateStellarActivityScore(scan);
  }

  if (operation === 'sybil.evidence') {
    return getSybilEvidence(identityId, network);
  }

  if (operation === 'soroban.evidence') {
    const { address, limit, cursor } = parameters;

    if (
      typeof address !== 'string' ||
      !isValidStellarGAddress(address) ||
      !Number.isInteger(limit) ||
      Number(limit) < 1 ||
      Number(limit) > 200 ||
      (cursor !== undefined && (typeof cursor !== 'string' || !/^[a-f0-9]{24}$/i.test(cursor)))
    ) {
      throw new Error('Invalid Soroban evidence query');
    }

    return readSorobanEvidence(
      identityId,
      address,
      network,
      Number(limit),
      cursor as string | undefined,
    );
  }

  throw new Error('Unknown reputation operation');
};

export default handleReputationRequest;

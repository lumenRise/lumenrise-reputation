import XDataSnapshot from './models/XDataSnapshot';
import ExternalAccount from './models/ExternalAccount';
import ProviderCredential from './models/ProviderCredential';
import GitHubDataSnapshot from './models/GitHubDataSnapshot';
import IntegrationSyncJob from './models/IntegrationSyncJob';
import ReputationSnapshot from './models/ReputationSnapshot';
import StellarPaymentFact from './models/StellarPaymentFact';
import StellarActivityScan from './models/StellarActivityScan';
import GitHubRepositoryFact from './models/GitHubRepositoryFact';
import SorobanTransactionEvidence from './models/SorobanTransactionEvidence';

const assertRequiredIndexes = async (): Promise<void> => {
  const models = [
    ExternalAccount,
    ProviderCredential,
    IntegrationSyncJob,
    GitHubDataSnapshot,
    GitHubRepositoryFact,
    XDataSnapshot,
    ReputationSnapshot,
    StellarActivityScan,
    StellarPaymentFact,
    SorobanTransactionEvidence,
  ];

  for (const model of models) {
    let present: Set<string>;
    try {
      present = new Set(
        (await model.collection.indexes())
          .map((index) => index.name)
          .filter((name): name is string => Boolean(name)),
      );
    } catch {
      throw new Error(`${model.modelName} indexes are unavailable; run API migrations first`);
    }
    for (const [, options] of model.schema.indexes()) {
      if (options.name && !present.has(options.name)) {
        throw new Error(`${model.modelName} index ${options.name} is missing; run API migrations first`);
      }
    }
  }
};

export default assertRequiredIndexes;

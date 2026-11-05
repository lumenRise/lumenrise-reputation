const startReputationFixture = async (): Promise<void> => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (
    input: Parameters<typeof fetch>[0],
    options?: Parameters<typeof fetch>[1],
  ): ReturnType<typeof fetch> => {
    if (String(input) === 'https://horizon-public.example.test') {
      return Promise.resolve(
        Response.json({ network_passphrase: 'Public Global Stellar Network ; September 2015' }),
      );
    }

    return originalFetch(input, options);
  };

  await import('../../dist/index.js');
};

void startReputationFixture();

const parseProviderUrl = (value: string, name: string, production: boolean): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(`${name} must be an HTTP or HTTPS URL without credentials`);
  }
  if (production && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production`);
  }
  return url;
};

export default parseProviderUrl;

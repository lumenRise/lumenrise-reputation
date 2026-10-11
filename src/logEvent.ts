import log from './logger';

type LogField = string | number | boolean | null;

const logEvent = (
  level: 'info' | 'warn' | 'error' | 'fatal',
  event: string,
  fields: Record<string, LogField> = {},
): void => {
  log[level]({ ...fields, event }, event);
};

export default logEvent;

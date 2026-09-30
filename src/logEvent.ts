type LogField = string | number | boolean | null;

const logEvent = (
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, LogField> = {},
): void => {
  const entry = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.info(entry);
  }
};

export default logEvent;

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const REDACTED_KEYS = new Set(['message', 'latexSource', 'content', 'prompt', 'userMessage']);

function getLevel() {
  const level = String(import.meta.env.VITE_LOG_LEVEL || 'info').toLowerCase();
  return LEVEL_PRIORITY[level] ? level : 'info';
}

function shouldLog(level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getLevel()];
}

function hashText(value = '') {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

function sanitize(meta = {}) {
  const output = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (typeof value === 'string' && REDACTED_KEYS.has(key)) {
      output[key] = `[REDACTED len=${value.length} h=${hashText(value)}]`;
      return;
    }

    if (value instanceof Error) {
      output[key] = {
        name: value.name,
        message: value.message,
        stack: import.meta.env.DEV ? value.stack : undefined
      };
      return;
    }

    output[key] = value;
  });
  return output;
}

function print(level, namespace, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const clean = sanitize(meta);
  const line = `[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}`;

  if (level === 'error') {
    console.error(line, clean);
    return;
  }

  if (level === 'warn') {
    console.warn(line, clean);
    return;
  }

  console.log(line, clean);
}

export function createLogger(namespace, baseMeta = {}) {
  return {
    debug(message, meta = {}) {
      print('debug', namespace, message, { ...baseMeta, ...meta });
    },
    info(message, meta = {}) {
      print('info', namespace, message, { ...baseMeta, ...meta });
    },
    warn(message, meta = {}) {
      print('warn', namespace, message, { ...baseMeta, ...meta });
    },
    error(message, meta = {}) {
      print('error', namespace, message, { ...baseMeta, ...meta });
    },
    child(extraMeta = {}) {
      return createLogger(namespace, { ...baseMeta, ...extraMeta });
    }
  };
}

export function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
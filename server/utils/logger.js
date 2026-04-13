import { createHash } from 'node:crypto';

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const REDACTED_KEYS = new Set([
  'latexSource',
  'message',
  'userMessage',
  'systemPrompt',
  'content',
  'prompt'
]);

function getConfiguredLevel() {
  const configured = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVEL_PRIORITY[configured] ? configured : 'info';
}

function shouldLogLevel(level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

function isDebugEnabled(namespace) {
  const raw = String(process.env.DEBUG || '').trim();
  if (!raw) {
    return false;
  }

  if (raw === '*') {
    return true;
  }

  const patterns = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      return namespace.startsWith(pattern.slice(0, -1));
    }
    return namespace === pattern;
  });
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function hashText(value = '') {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function redactValue(key, value) {
  if (typeof value === 'string' && REDACTED_KEYS.has(key)) {
    return `[REDACTED len=${value.length} sha=${hashText(value)}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : value.stack
    };
  }

  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 500)}...[truncated ${value.length - 500} chars]`;
  }

  return value;
}

function sanitizeMeta(meta = {}) {
  const sanitized = {};

  Object.entries(meta).forEach(([key, value]) => {
    sanitized[key] = redactValue(key, value);
  });

  return sanitized;
}

function formatMeta(meta) {
  const entries = Object.entries(meta);
  if (entries.length === 0) {
    return '';
  }

  return entries
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : safeStringify(value)}`)
    .join(' ');
}

function emit(level, namespace, message, meta = {}) {
  if (level === 'debug' && !isDebugEnabled(namespace)) {
    return;
  }

  if (!shouldLogLevel(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const sanitizedMeta = sanitizeMeta(meta);
  const metaPart = formatMeta(sanitizedMeta);
  const line = `[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}${metaPart ? ` ${metaPart}` : ''}`;

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger(namespace, baseMeta = {}) {
  return {
    debug(message, meta = {}) {
      emit('debug', namespace, message, { ...baseMeta, ...meta });
    },
    info(message, meta = {}) {
      emit('info', namespace, message, { ...baseMeta, ...meta });
    },
    warn(message, meta = {}) {
      emit('warn', namespace, message, { ...baseMeta, ...meta });
    },
    error(message, meta = {}) {
      emit('error', namespace, message, { ...baseMeta, ...meta });
    },
    child(extraMeta = {}) {
      return createLogger(namespace, { ...baseMeta, ...extraMeta });
    }
  };
}
export function cleanFirebaseString(value, fallback = '') {
  if (typeof value !== 'string') {
    return value === null || value === undefined ? fallback : String(value);
  }

  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const decoded = JSON.parse(trimmed);
      return typeof decoded === 'string' ? decoded : trimmed.slice(1, -1);
    } catch {
      return trimmed.slice(1, -1).replace(/\\"/g, '"');
    }
  }
  return value;
}

export function numericValue(value, fallback = 0) {
  const cleaned = cleanFirebaseString(value).trim();
  if (!cleaned) return fallback;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseQuizQuestion(raw) {
  let values = raw;
  if (typeof raw === 'string') {
    try {
      values = JSON.parse(cleanFirebaseString(raw));
    } catch {
      throw new Error('Quiz question has an invalid format.');
    }
  }
  if (!Array.isArray(values) || values.length < 2 || values.some((value) => typeof value !== 'string')) {
    throw new Error('Quiz question has an invalid format.');
  }

  const question = cleanFirebaseString(values[0]);
  const answers = values.slice(1).map((value) => cleanFirebaseString(value));
  const options = answers.map((value) => value.replace(/===true$/, ''));
  const correctIndex = answers.findIndex((value) => value.endsWith('===true'));
  if (!question || options.length < 2 || correctIndex < 0 || options.some((option) => !option)) {
    throw new Error('Quiz question does not define a question and valid answer choices.');
  }
  return { question, options, correctIndex };
}

export function parseQuizRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Quiz questions are missing or have an invalid format.');
  }
  const keys = Object.keys(record)
    .filter((key) => /^Q\d+$/.test(key))
    .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  if (keys.length === 0) {
    throw new Error('No quiz questions are available.');
  }
  return keys.map((key) => parseQuizQuestion(record[key]));
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(numericValue(seconds)));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${remainder} Sec`;
}

export function normalizePhone(value) {
  const phone = String(value ?? '').trim();
  return /^\+?\d{6,15}$/.test(phone) ? phone : '';
}

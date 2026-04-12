const REQUIRED_FIELD_QUESTIONS = {
  'personalInfo.name': 'What is your full name?',
  'personalInfo.Birthdate': 'What is your birthdate?',
  'contact.phonenumber': 'What is your phone number?',
  'contact.email': 'What is your email address?',
  'contact.adress': 'What is your address?',
  Profile: 'Can you write a short profile summary about yourself?',
  Work_experience: 'Please add at least one work experience entry (role, company, period, description).',
  Education: 'Please add at least one education entry (period, institution, degree).'
};

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeCvData(input = {}) {
  const source = toRecord(input);

  return {
    photo: typeof source.photo === 'string' ? source.photo : '',
    personalInfo: {
      name: typeof source.personalInfo?.name === 'string' ? source.personalInfo.name : '',
      Birthdate: typeof source.personalInfo?.Birthdate === 'string' ? source.personalInfo.Birthdate : ''
    },
    contact: {
      phonenumber: typeof source.contact?.phonenumber === 'string' ? source.contact.phonenumber : '',
      email: typeof source.contact?.email === 'string' ? source.contact.email : '',
      adress: typeof source.contact?.adress === 'string' ? source.contact.adress : '',
      linkedin: typeof source.contact?.linkedin === 'string' ? source.contact.linkedin : '',
      github: typeof source.contact?.github === 'string' ? source.contact.github : ''
    },
    skills: {
      programmingLanguages: toArray(source.skills?.programmingLanguages).map(String),
      frameworks: toArray(source.skills?.frameworks).map(String)
    },
    languages: toRecord(source.languages),
    Hobbies: toArray(source.Hobbies).map(String),
    Profile: typeof source.Profile === 'string' ? source.Profile : '',
    Work_experience: toRecord(source.Work_experience),
    Education: toRecord(source.Education),
    Hackathons: toRecord(source.Hackathons),
    Prizes: toRecord(source.Prizes),
    Degrees: toRecord(source.Degrees)
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidExperienceEntry(entries) {
  return Object.values(entries).some((entry) =>
    hasText(entry?.company) && hasText(entry?.period) && hasText(entry?.description)
  );
}

function hasValidEducationEntry(entries) {
  return Object.values(entries).some((entry) =>
    hasText(entry?.institution) && hasText(entry?.degree)
  );
}

export function getMissingRequiredFields(cvData = {}) {
  const normalized = normalizeCvData(cvData);
  const missing = [];

  if (!hasText(normalized.personalInfo.name)) {
    missing.push('personalInfo.name');
  }
  if (!hasText(normalized.personalInfo.Birthdate)) {
    missing.push('personalInfo.Birthdate');
  }
  if (!hasText(normalized.contact.phonenumber)) {
    missing.push('contact.phonenumber');
  }
  if (!hasText(normalized.contact.email)) {
    missing.push('contact.email');
  }
  if (!hasText(normalized.contact.adress)) {
    missing.push('contact.adress');
  }
  if (!hasText(normalized.Profile)) {
    missing.push('Profile');
  }
  if (!hasValidExperienceEntry(normalized.Work_experience)) {
    missing.push('Work_experience');
  }
  if (!hasValidEducationEntry(normalized.Education)) {
    missing.push('Education');
  }

  return missing;
}

export function getFollowUpQuestion(missingFields = []) {
  if (!missingFields.length) {
    return 'Great, we have all required information for a complete resume draft.';
  }

  const firstMissingField = missingFields[0];
  return REQUIRED_FIELD_QUESTIONS[firstMissingField] || 'I still need a bit more information to continue.';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeObjects(base, updates) {
  const merged = { ...base };

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) {
      delete merged[key];
      return;
    }

    if (isPlainObject(value) && isPlainObject(base[key])) {
      merged[key] = mergeObjects(base[key], value);
      return;
    }

    merged[key] = value;
  });

  return merged;
}

export function applyCvUpdates(cvData = {}, updates = {}) {
  const normalizedBase = normalizeCvData(cvData);

  if (!isPlainObject(updates)) {
    return normalizedBase;
  }

  const merged = mergeObjects(normalizedBase, updates);
  return normalizeCvData(merged);
}

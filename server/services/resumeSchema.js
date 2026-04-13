import { randomUUID } from 'node:crypto';

export const RESUME_SCHEMA_VERSION = '1.0.0';

export const SECTION_KEYS = {
  EXPERIENCE: 'experience',
  PROJECTS: 'projects',
  EDUCATION: 'education',
  SKILLS: 'skills',
  CERTIFICATIONS: 'certifications'
};

export const OPERATION_TYPES = {
  SET_CONTACT_FIELD: 'set_contact_field',
  ADD_CONTACT_LINK: 'add_contact_link',
  REMOVE_CONTACT_LINK: 'remove_contact_link',
  ADD_SECTION: 'add_section',
  UPDATE_SECTION_META: 'update_section_meta',
  TOGGLE_SECTION_VISIBILITY: 'toggle_section_visibility',
  REORDER_SECTIONS: 'reorder_sections',
  ADD_ENTRY: 'add_entry',
  UPDATE_ENTRY: 'update_entry',
  REMOVE_ENTRY: 'remove_entry',
  ADD_BULLET: 'add_bullet',
  UPDATE_BULLET: 'update_bullet',
  REMOVE_BULLET: 'remove_bullet',
  ADD_TOPIC_GROUP: 'add_topic_group',
  UPDATE_TOPIC_GROUP: 'update_topic_group',
  REMOVE_TOPIC_GROUP: 'remove_topic_group'
};

const DEFAULT_SECTION_ORDER = [
  SECTION_KEYS.EXPERIENCE,
  SECTION_KEYS.PROJECTS,
  SECTION_KEYS.EDUCATION,
  SECTION_KEYS.SKILLS,
  SECTION_KEYS.CERTIFICATIONS
];

function nowIso() {
  return new Date().toISOString();
}

export function createResumeEntry(overrides = {}) {
  return {
    id: overrides.id || randomUUID(),
    heading: overrides.heading || '',
    subheading: overrides.subheading || '',
    organization: overrides.organization || '',
    location: overrides.location || '',
    startDate: overrides.startDate || '',
    endDate: overrides.endDate || '',
    dateLabel: overrides.dateLabel || '',
    summary: overrides.summary || '',
    bullets: Array.isArray(overrides.bullets) ? overrides.bullets : [],
    tags: Array.isArray(overrides.tags) ? overrides.tags : [],
    comments: overrides.comments || ''
  };
}

export function createResumeSection(sectionId, title, type, visible = true) {
  return {
    id: sectionId,
    title,
    type,
    visible,
    entries: []
  };
}

export function createDefaultResumeData() {
  const timestamp = nowIso();
  return {
    schemaVersion: RESUME_SCHEMA_VERSION,
    locale: 'en',
    metadata: {
      templateKey: 'default-latex-template',
      resumeTitle: 'Resume',
      createdAt: timestamp,
      updatedAt: timestamp
    },
    contact: {
      fullName: '[Your Name]',
      headline: '',
      email: '[Email]',
      phone: '[Phone]',
      location: '[Location]',
      links: []
    },
    sections: {
      [SECTION_KEYS.EXPERIENCE]: createResumeSection(SECTION_KEYS.EXPERIENCE, 'EXPERIENCE', 'timeline', true),
      [SECTION_KEYS.PROJECTS]: createResumeSection(SECTION_KEYS.PROJECTS, 'PROJECTS', 'timeline', true),
      [SECTION_KEYS.EDUCATION]: createResumeSection(SECTION_KEYS.EDUCATION, 'EDUCATION', 'timeline', true),
      [SECTION_KEYS.SKILLS]: {
        id: SECTION_KEYS.SKILLS,
        title: 'SKILLS',
        type: 'topic_groups',
        visible: true,
        entries: [
          {
            id: 'languages',
            topicLabel: 'Languages',
            items: [],
            comments: ''
          },
          {
            id: 'tools',
            topicLabel: 'Tools',
            items: [],
            comments: ''
          }
        ]
      },
      [SECTION_KEYS.CERTIFICATIONS]: createResumeSection(SECTION_KEYS.CERTIFICATIONS, 'CERTIFICATIONS', 'timeline', false)
    },
    customSections: [],
    presentation: {
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      hiddenSections: []
    }
  };
}

export function touchResumeData(resumeData) {
  return {
    ...resumeData,
    metadata: {
      ...resumeData.metadata,
      updatedAt: nowIso()
    }
  };
}

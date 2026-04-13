import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.js';
import { OPERATION_TYPES, createResumeEntry, touchResumeData } from './resumeSchema.js';
import { validateResumeOperation, validateResumeData } from './resumeValidator.js';

const logger = createLogger('resumeOperationApplier');

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSection(resumeData, sectionId) {
  if (resumeData.sections?.[sectionId]) {
    return resumeData.sections[sectionId];
  }

  return (resumeData.customSections || []).find((section) => section.id === sectionId) || null;
}

function getEntryIndex(section, entryId) {
  return section.entries.findIndex((entry) => entry.id === entryId);
}

function assertTarget(condition, code, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

function applySingleOperation(resumeData, operation) {
  const { opType, target = {}, payload } = operation;

  switch (opType) {
    case OPERATION_TYPES.SET_CONTACT_FIELD: {
      assertTarget(typeof target.field === 'string', 'INVALID_TARGET', 'target.field is required for set_contact_field');
      resumeData.contact[target.field] = payload;
      return;
    }

    case OPERATION_TYPES.ADD_CONTACT_LINK: {
      assertTarget(Array.isArray(resumeData.contact.links), 'INVALID_CONTACT_LINKS', 'contact.links must be an array');
      resumeData.contact.links.push({
        id: payload?.id || randomUUID(),
        label: payload?.label || '',
        url: payload?.url || ''
      });
      return;
    }

    case OPERATION_TYPES.REMOVE_CONTACT_LINK: {
      assertTarget(Array.isArray(resumeData.contact.links), 'INVALID_CONTACT_LINKS', 'contact.links must be an array');
      resumeData.contact.links = resumeData.contact.links.filter((item) => item.id !== target.linkId);
      return;
    }

    case OPERATION_TYPES.ADD_SECTION: {
      assertTarget(typeof target.sectionId === 'string', 'INVALID_TARGET', 'target.sectionId is required for add_section');
      assertTarget(!resumeData.sections[target.sectionId], 'SECTION_EXISTS', `Section '${target.sectionId}' already exists`);
      const section = {
        id: target.sectionId,
        title: payload?.title || target.sectionId.toUpperCase(),
        type: payload?.type || 'timeline',
        visible: payload?.visible !== false,
        entries: []
      };
      resumeData.customSections.push(section);
      if (!resumeData.presentation.sectionOrder.includes(section.id)) {
        resumeData.presentation.sectionOrder.push(section.id);
      }
      return;
    }

    case OPERATION_TYPES.UPDATE_SECTION_META: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      section.title = payload?.title ?? section.title;
      section.type = payload?.type ?? section.type;
      if (typeof payload?.visible === 'boolean') {
        section.visible = payload.visible;
      }
      return;
    }

    case OPERATION_TYPES.TOGGLE_SECTION_VISIBILITY: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      section.visible = Boolean(payload?.visible);
      return;
    }

    case OPERATION_TYPES.REORDER_SECTIONS: {
      assertTarget(Array.isArray(payload), 'INVALID_PAYLOAD', 'Payload must be a section id array for reorder_sections');
      resumeData.presentation.sectionOrder = payload;
      return;
    }

    case OPERATION_TYPES.ADD_ENTRY: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      section.entries.push(createResumeEntry(payload || {}));
      return;
    }

    case OPERATION_TYPES.UPDATE_ENTRY: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      const entryIndex = getEntryIndex(section, target.entryId);
      assertTarget(entryIndex >= 0, 'ENTRY_NOT_FOUND', `Entry '${target.entryId}' not found`);
      section.entries[entryIndex] = {
        ...section.entries[entryIndex],
        ...payload
      };
      return;
    }

    case OPERATION_TYPES.REMOVE_ENTRY: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      section.entries = section.entries.filter((entry) => entry.id !== target.entryId);
      return;
    }

    case OPERATION_TYPES.ADD_BULLET: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      const entryIndex = getEntryIndex(section, target.entryId);
      assertTarget(entryIndex >= 0, 'ENTRY_NOT_FOUND', `Entry '${target.entryId}' not found`);
      const entry = section.entries[entryIndex];
      entry.bullets = Array.isArray(entry.bullets) ? entry.bullets : [];
      entry.bullets.push(String(payload || ''));
      return;
    }

    case OPERATION_TYPES.UPDATE_BULLET: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      const entryIndex = getEntryIndex(section, target.entryId);
      assertTarget(entryIndex >= 0, 'ENTRY_NOT_FOUND', `Entry '${target.entryId}' not found`);
      const entry = section.entries[entryIndex];
      const bulletIndex = Number(target.bulletIndex);
      assertTarget(Number.isInteger(bulletIndex), 'INVALID_TARGET', 'target.bulletIndex must be an integer');
      assertTarget(Array.isArray(entry.bullets) && entry.bullets[bulletIndex] !== undefined, 'BULLET_NOT_FOUND', 'Bullet not found');
      entry.bullets[bulletIndex] = String(payload || '');
      return;
    }

    case OPERATION_TYPES.REMOVE_BULLET: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      const entryIndex = getEntryIndex(section, target.entryId);
      assertTarget(entryIndex >= 0, 'ENTRY_NOT_FOUND', `Entry '${target.entryId}' not found`);
      const entry = section.entries[entryIndex];
      const bulletIndex = Number(target.bulletIndex);
      assertTarget(Number.isInteger(bulletIndex), 'INVALID_TARGET', 'target.bulletIndex must be an integer');
      entry.bullets = Array.isArray(entry.bullets) ? entry.bullets.filter((_, index) => index !== bulletIndex) : [];
      return;
    }

    case OPERATION_TYPES.ADD_TOPIC_GROUP: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      section.entries.push({
        id: payload?.id || randomUUID(),
        topicLabel: payload?.topicLabel || 'Topic',
        items: Array.isArray(payload?.items) ? payload.items : [],
        comments: payload?.comments || ''
      });
      return;
    }

    case OPERATION_TYPES.UPDATE_TOPIC_GROUP: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      const entryIndex = getEntryIndex(section, target.topicGroupId || target.entryId);
      assertTarget(entryIndex >= 0, 'TOPIC_GROUP_NOT_FOUND', 'Topic group not found');
      section.entries[entryIndex] = {
        ...section.entries[entryIndex],
        ...payload
      };
      return;
    }

    case OPERATION_TYPES.REMOVE_TOPIC_GROUP: {
      const section = getSection(resumeData, target.sectionId);
      assertTarget(section, 'SECTION_NOT_FOUND', `Section '${target.sectionId}' not found`);
      const targetId = target.topicGroupId || target.entryId;
      section.entries = section.entries.filter((entry) => entry.id !== targetId);
      return;
    }

    default:
      throw new Error(`Unsupported operation type '${opType}'`);
  }
}

export function applyResumeOperations({ resumeData, operations = [], requestId = 'unknown' }) {
  const requestLogger = logger.child({ requestId });
  const cloned = cloneDeep(resumeData);
  const auditTrail = [];

  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    const validation = validateResumeOperation(operation);
    if (!validation.valid) {
      const error = new Error(`Operation at index ${index} failed validation.`);
      error.code = 'OPERATION_VALIDATION_FAILED';
      error.details = validation.errors;
      throw error;
    }

    try {
      applySingleOperation(cloned, operation);
      auditTrail.push({
        operationId: operation.operationId || randomUUID(),
        index,
        opType: operation.opType,
        target: operation.target,
        status: 'applied',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      requestLogger.warn('operation.apply.failed', {
        index,
        opType: operation.opType,
        error,
        reasonCode: error.code || 'OPERATION_APPLY_FAILED'
      });
      throw error;
    }
  }

  const touched = touchResumeData(cloned);
  const validation = validateResumeData(touched);
  if (!validation.valid) {
    const error = new Error('Resume data failed validation after applying operations.');
    error.code = 'RESUME_VALIDATION_FAILED';
    error.details = validation.errors;
    throw error;
  }

  return {
    resumeData: touched,
    auditTrail,
    warnings: validation.warnings || []
  };
}

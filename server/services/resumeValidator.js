import { OPERATION_TYPES } from './resumeSchema.js';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushError(errors, code, message, path) {
  errors.push({ code, message, path });
}

export function validateResumeData(resumeData) {
  const errors = [];
  const warnings = [];

  if (!isObject(resumeData)) {
    return {
      valid: false,
      errors: [{ code: 'RESUME_NOT_OBJECT', message: 'Resume data must be an object.', path: '$' }],
      warnings
    };
  }

  if (!isObject(resumeData.contact)) {
    pushError(errors, 'MISSING_CONTACT', 'Contact object is required.', '$.contact');
  }

  if (!isObject(resumeData.sections)) {
    pushError(errors, 'MISSING_SECTIONS', 'Sections object is required.', '$.sections');
  }

  if (!Array.isArray(resumeData.customSections)) {
    pushError(errors, 'INVALID_CUSTOM_SECTIONS', 'customSections must be an array.', '$.customSections');
  }

  if (!isObject(resumeData.presentation)) {
    pushError(errors, 'MISSING_PRESENTATION', 'Presentation object is required.', '$.presentation');
  }

  const sectionEntries = isObject(resumeData.sections) ? Object.entries(resumeData.sections) : [];
  sectionEntries.forEach(([sectionId, section]) => {
    if (!isObject(section)) {
      pushError(errors, 'INVALID_SECTION', `Section '${sectionId}' must be an object.`, `$.sections.${sectionId}`);
      return;
    }

    if (!Array.isArray(section.entries)) {
      pushError(errors, 'INVALID_SECTION_ENTRIES', `Section '${sectionId}' entries must be an array.`, `$.sections.${sectionId}.entries`);
      return;
    }

    section.entries.forEach((entry, index) => {
      if (!isObject(entry)) {
        pushError(errors, 'INVALID_ENTRY', `Entry ${index} in section '${sectionId}' must be an object.`, `$.sections.${sectionId}.entries[${index}]`);
        return;
      }

      if (section.type === 'topic_groups') {
        if (!Array.isArray(entry.items)) {
          pushError(
            errors,
            'INVALID_TOPIC_ITEMS',
            `Topic group items in section '${sectionId}' must be an array.`,
            `$.sections.${sectionId}.entries[${index}].items`
          );
        }
      } else if (entry.bullets && !Array.isArray(entry.bullets)) {
        pushError(
          errors,
          'INVALID_BULLETS',
          `Bullets in section '${sectionId}' entry '${entry.id || index}' must be an array.`,
          `$.sections.${sectionId}.entries[${index}].bullets`
        );
      }
    });
  });

  if (Array.isArray(resumeData.presentation?.sectionOrder)) {
    resumeData.presentation.sectionOrder.forEach((sectionId, index) => {
      const existsInKnownSections = isObject(resumeData.sections) && Boolean(resumeData.sections[sectionId]);
      const existsInCustomSections = Array.isArray(resumeData.customSections)
        && resumeData.customSections.some((section) => section.id === sectionId);

      if (!existsInKnownSections && !existsInCustomSections) {
        warnings.push({
          code: 'SECTION_ORDER_ORPHAN',
          message: `Section '${sectionId}' in sectionOrder does not exist in sections/customSections.`,
          path: `$.presentation.sectionOrder[${index}]`
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateResumeOperation(operation) {
  const errors = [];

  if (!isObject(operation)) {
    return {
      valid: false,
      errors: [{ code: 'OPERATION_NOT_OBJECT', message: 'Operation must be an object.', path: '$' }]
    };
  }

  if (!operation.opType || typeof operation.opType !== 'string') {
    pushError(errors, 'MISSING_OP_TYPE', 'Operation opType is required.', '$.opType');
  } else if (!Object.values(OPERATION_TYPES).includes(operation.opType)) {
    pushError(errors, 'UNSUPPORTED_OP_TYPE', `Unsupported operation type '${operation.opType}'.`, '$.opType');
  }

  if (!isObject(operation.target)) {
    pushError(errors, 'MISSING_TARGET', 'Operation target must be an object.', '$.target');
  }

  if (!('payload' in operation)) {
    pushError(errors, 'MISSING_PAYLOAD', 'Operation payload is required.', '$.payload');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateResumeOperations(operations) {
  if (!Array.isArray(operations)) {
    return {
      valid: false,
      errors: [{ code: 'OPERATIONS_NOT_ARRAY', message: 'Operations must be an array.', path: '$' }]
    };
  }

  const errors = [];
  operations.forEach((operation, index) => {
    const result = validateResumeOperation(operation);
    if (!result.valid) {
      result.errors.forEach((error) => {
        errors.push({ ...error, path: `$.operations[${index}]${error.path === '$' ? '' : error.path.slice(1)}` });
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

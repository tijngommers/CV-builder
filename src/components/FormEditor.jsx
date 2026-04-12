import { useState } from 'react';
import './FormEditor.css';

export function FormEditor({ cvData, onUpdate, missingFields }) {
  const [pendingArrayItems, setPendingArrayItems] = useState({});
  const clone = (value) => JSON.parse(JSON.stringify(value || {}));

  const updateAtPath = (path, value) => {
    const keys = path.split('.');
    const nextData = clone(cvData);
    let current = nextData;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    onUpdate(nextData);
  };

  const removeAtPath = (path) => {
    const keys = path.split('.');
    const nextData = clone(cvData);
    let current = nextData;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current?.[keys[i]];
      if (!current || typeof current !== 'object') {
        return;
      }
    }

    delete current[keys[keys.length - 1]];
    onUpdate(nextData);
  };

  const renameRecordKey = (sectionKey, oldKey, newKey) => {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed === oldKey) {
      return;
    }

    const section = cvData?.[sectionKey] || {};
    if (Object.prototype.hasOwnProperty.call(section, trimmed)) {
      return;
    }

    const nextData = clone(cvData);
    nextData[sectionKey] = nextData[sectionKey] || {};
    nextData[sectionKey][trimmed] = nextData[sectionKey][oldKey];
    delete nextData[sectionKey][oldKey];
    onUpdate(nextData);
  };

  const addRecordEntry = (sectionKey, defaultKey, defaultValue) => {
    const nextData = clone(cvData);
    nextData[sectionKey] = nextData[sectionKey] || {};

    let candidate = defaultKey;
    let counter = 1;
    while (Object.prototype.hasOwnProperty.call(nextData[sectionKey], candidate)) {
      candidate = `${defaultKey} ${counter}`;
      counter += 1;
    }

    nextData[sectionKey][candidate] = defaultValue;
    onUpdate(nextData);
  };

  const removeRecordEntry = (sectionKey, key) => {
    removeAtPath(`${sectionKey}.${key}`);
  };

  const addArrayItem = (path, value = '') => {
    const current = path.split('.').reduce((acc, key) => acc?.[key], cvData) || [];
    updateAtPath(path, [...current, value]);
  };

  const updateArrayItem = (path, index, value) => {
    const current = path.split('.').reduce((acc, key) => acc?.[key], cvData) || [];
    const next = [...current];
    next[index] = value;
    updateAtPath(path, next);
  };

  const removeArrayItem = (path, index) => {
    const current = path.split('.').reduce((acc, key) => acc?.[key], cvData) || [];
    updateAtPath(path, current.filter((_, itemIndex) => itemIndex !== index));
  };

  const setPendingArrayValue = (path, value) => {
    setPendingArrayItems((previous) => ({
      ...previous,
      [path]: value
    }));
  };

  const addPendingArrayValue = (path) => {
    const nextValue = (pendingArrayItems[path] || '').trim();
    if (!nextValue) {
      return;
    }

    addArrayItem(path, nextValue);
    setPendingArrayValue(path, '');
  };

  const renderStringArrayEditor = (title, path, placeholder) => {
    const values = path.split('.').reduce((acc, key) => acc?.[key], cvData) || [];
    const pendingValue = pendingArrayItems[path] || '';

    return (
      <div className="form-section">
        <h3>{title}</h3>
        <div className="array-add-row">
          <input
            type="text"
            value={pendingValue}
            onChange={(event) => setPendingArrayValue(path, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addPendingArrayValue(path);
              }
            }}
            placeholder={`Add ${placeholder.toLowerCase()}`}
          />
          <button type="button" className="add-item-btn" onClick={() => addPendingArrayValue(path)}>
            Add
          </button>
        </div>
        <div className="fields-container">
          {values.length === 0 ? <p className="empty-fields">No items yet.</p> : null}
          {values.map((value, index) => (
            <div className="list-item" key={`${path}-${index}`}>
              <input
                type="text"
                value={value}
                onChange={(event) => updateArrayItem(path, index, event.target.value)}
                placeholder={placeholder}
              />
              <button type="button" className="action-btn delete" onClick={() => removeArrayItem(path, index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRecordSection = (title, sectionKey, defaults, fields, requiredField, options = {}) => {
    const entries = Object.entries(cvData?.[sectionKey] || {});
    const sectionClass = requiredField && isMissing(requiredField) ? 'form-group missing-field' : '';
    const valueIsPrimitive = options.valueIsPrimitive === true;

    return (
      <div className="form-section">
        <h3>{title}</h3>
        {requiredField && isMissing(requiredField) ? <div className="missing-fields-summary">This section is required.</div> : null}
        <div className="fields-container">
          {entries.length === 0 ? <p className="empty-fields">No entries yet.</p> : null}
          {entries.map(([entryKey, entry]) => (
            <div key={`${sectionKey}-${entryKey}`} className={`field-wrapper ${sectionClass}`.trim()}>
              <div className="field-header">
                <label>Entry Label</label>
                <div>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => {
                      const renamed = window.prompt('Rename entry label', entryKey);
                      if (typeof renamed === 'string') {
                        renameRecordKey(sectionKey, entryKey, renamed);
                      }
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" className="action-btn delete" onClick={() => removeRecordEntry(sectionKey, entryKey)}>
                    Remove Entry
                  </button>
                </div>
              </div>
              <input type="text" value={entryKey} readOnly placeholder="Entry name" />
              {fields.map((field) => (
                <div className="form-group" key={`${sectionKey}-${entryKey}-${field.key}`}>
                  <label>{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={valueIsPrimitive ? (entry || '') : (entry?.[field.key] || '')}
                      rows={field.rows || 3}
                      onChange={(event) =>
                        updateAtPath(
                          valueIsPrimitive ? `${sectionKey}.${entryKey}` : `${sectionKey}.${entryKey}.${field.key}`,
                          event.target.value
                        )
                      }
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      type="text"
                      value={valueIsPrimitive ? (entry || '') : (entry?.[field.key] || '')}
                      onChange={(event) =>
                        updateAtPath(
                          valueIsPrimitive ? `${sectionKey}.${entryKey}` : `${sectionKey}.${entryKey}.${field.key}`,
                          event.target.value
                        )
                      }
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="add-item-btn"
          onClick={() => addRecordEntry(sectionKey, defaults.key, defaults.value)}
        >
          Add Entry
        </button>
      </div>
    );
  };

  const isMissing = (field) => missingFields.includes(field);
  const highlightMissing = (field) => isMissing(field) ? 'missing-field' : '';

  return (
    <div className="form-editor">
      <div className="form-header">
        <h2>Resume Information</h2>
      </div>
      <div className="form-content">
      <div className="form-section">
        <h3>Personal Information</h3>
        <div className={`form-group ${highlightMissing('personalInfo.name')}`}>
          <label htmlFor="name">Name {isMissing('personalInfo.name') && <span className="required-badge">*</span>}</label>
          <input
            id="name"
            type="text"
            value={cvData.personalInfo?.name || ''}
            onChange={(e) => updateAtPath('personalInfo.name', e.target.value)}
            placeholder="Your full name"
          />
        </div>

        <div className={`form-group ${highlightMissing('personalInfo.Birthdate')}`}>
          <label htmlFor="birthdate">Birthdate {isMissing('personalInfo.Birthdate') && <span className="required-badge">*</span>}</label>
          <input
            id="birthdate"
            type="text"
            value={cvData.personalInfo?.Birthdate || ''}
            onChange={(e) => updateAtPath('personalInfo.Birthdate', e.target.value)}
            placeholder="DD/MM/YYYY"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Contact</h3>
        <div className={`form-group ${highlightMissing('contact.phonenumber')}`}>
          <label htmlFor="phone">Phone {isMissing('contact.phonenumber') && <span className="required-badge">*</span>}</label>
          <input
            id="phone"
            type="tel"
            value={cvData.contact?.phonenumber || ''}
            onChange={(e) => updateAtPath('contact.phonenumber', e.target.value)}
            placeholder="Your phone number"
          />
        </div>

        <div className={`form-group ${highlightMissing('contact.email')}`}>
          <label htmlFor="email">Email {isMissing('contact.email') && <span className="required-badge">*</span>}</label>
          <input
            id="email"
            type="email"
            value={cvData.contact?.email || ''}
            onChange={(e) => updateAtPath('contact.email', e.target.value)}
            placeholder="your.email@example.com"
          />
        </div>

        <div className={`form-group ${highlightMissing('contact.adress')}`}>
          <label htmlFor="address">Address {isMissing('contact.adress') && <span className="required-badge">*</span>}</label>
          <input
            id="address"
            type="text"
            value={cvData.contact?.adress || ''}
            onChange={(e) => updateAtPath('contact.adress', e.target.value)}
            placeholder="Your address"
          />
        </div>

        <div className="form-group">
          <label htmlFor="linkedin">LinkedIn</label>
          <input
            id="linkedin"
            type="url"
            value={cvData.contact?.linkedin || ''}
            onChange={(e) => updateAtPath('contact.linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>

        <div className="form-group">
          <label htmlFor="github">GitHub</label>
          <input
            id="github"
            type="url"
            value={cvData.contact?.github || ''}
            onChange={(e) => updateAtPath('contact.github', e.target.value)}
            placeholder="https://github.com/yourprofile"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Profile</h3>
        <div className={`form-group ${highlightMissing('Profile')}`}>
          <label htmlFor="profile">Professional Summary {isMissing('Profile') && <span className="required-badge">*</span>}</label>
          <textarea
            id="profile"
            value={cvData.Profile || ''}
            onChange={(e) => updateAtPath('Profile', e.target.value)}
            placeholder="Write a brief professional summary..."
            rows="4"
          />
        </div>
      </div>

      {renderStringArrayEditor('Programming Languages', 'skills.programmingLanguages', 'Language')}
      {renderStringArrayEditor('Frameworks', 'skills.frameworks', 'Framework')}
      {renderStringArrayEditor('Hobbies', 'Hobbies', 'Hobby')}

      {renderRecordSection(
        'Work Experience',
        'Work_experience',
        {
          key: 'New Role',
          value: { company: '', period: '', description: '' }
        },
        [
          { key: 'company', label: 'Company', placeholder: 'Company name' },
          { key: 'period', label: 'Period', placeholder: '2024-2026' },
          { key: 'description', label: 'Description', placeholder: 'What you did', type: 'textarea', rows: 4 }
        ],
        'Work_experience'
      )}

      {renderRecordSection(
        'Education',
        'Education',
        {
          key: 'New Education',
          value: { institution: '', degree: '', period: '' }
        },
        [
          { key: 'institution', label: 'Institution', placeholder: 'School or University' },
          { key: 'degree', label: 'Degree', placeholder: 'Degree name' },
          { key: 'period', label: 'Period', placeholder: '2023-2026' }
        ],
        'Education'
      )}

      {renderRecordSection(
        'Hackathons',
        'Hackathons',
        {
          key: 'New Hackathon',
          value: { date: '', description: '' }
        },
        [
          { key: 'date', label: 'Date', placeholder: '2026' },
          { key: 'description', label: 'Description', placeholder: 'Result or project', type: 'textarea', rows: 3 }
        ]
      )}

      {renderRecordSection(
        'Prizes',
        'Prizes',
        {
          key: 'New Prize',
          value: { date: '', description: '' }
        },
        [
          { key: 'date', label: 'Date', placeholder: '2026' },
          { key: 'description', label: 'Description', placeholder: 'Award details', type: 'textarea', rows: 3 }
        ]
      )}

      {renderRecordSection(
        'Degrees & Certifications',
        'Degrees',
        {
          key: 'New Certification',
          value: { organization: '', degree: '', date: '' }
        },
        [
          { key: 'organization', label: 'Organization', placeholder: 'Issuer' },
          { key: 'degree', label: 'Credential', placeholder: 'Certificate or degree' },
          { key: 'date', label: 'Date', placeholder: '2026' }
        ]
      )}

      {renderRecordSection(
        'Languages (Spoken)',
        'languages',
        {
          key: 'New Language',
          value: ''
        },
        [{ key: 'value', label: 'Level', placeholder: 'Fluent, Native, B2...' }],
        undefined,
        { valueIsPrimitive: true }
      )}

      <div className="form-section">
        <h3>Missing Required Fields</h3>
        {missingFields.length > 0 ? (
          <div className="missing-fields-list">
            {missingFields.map((field) => (
              <div key={field} className="missing-field-item">
                <span className="field-name">{field}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="all-fields-complete">✓ All required fields completed!</p>
        )}
      </div>
      </div>
    </div>
  );
}

import './FormEditor.css';

export function FormEditor({ cvData, onUpdate, missingFields }) {
  const handleInputChange = (field, value) => {
    const keys = field.split('.');
    const newData = JSON.parse(JSON.stringify(cvData)); // Deep clone
    let current = newData;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    onUpdate(newData);
  };

  const isMissing = (field) => missingFields.includes(field);
  const highlightMissing = (field) => isMissing(field) ? 'missing-field' : '';

  return (
    <div className="form-editor">
      <div className="form-section">
        <h3>Personal Information</h3>
        <div className={`form-group ${highlightMissing('personalInfo.name')}`}>
          <label htmlFor="name">Name {isMissing('personalInfo.name') && <span className="required-badge">*</span>}</label>
          <input
            id="name"
            type="text"
            value={cvData.personalInfo?.name || ''}
            onChange={(e) => handleInputChange('personalInfo.name', e.target.value)}
            placeholder="Your full name"
          />
        </div>

        <div className={`form-group ${highlightMissing('personalInfo.Birthdate')}`}>
          <label htmlFor="birthdate">Birthdate {isMissing('personalInfo.Birthdate') && <span className="required-badge">*</span>}</label>
          <input
            id="birthdate"
            type="text"
            value={cvData.personalInfo?.Birthdate || ''}
            onChange={(e) => handleInputChange('personalInfo.Birthdate', e.target.value)}
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
            onChange={(e) => handleInputChange('contact.phonenumber', e.target.value)}
            placeholder="Your phone number"
          />
        </div>

        <div className={`form-group ${highlightMissing('contact.email')}`}>
          <label htmlFor="email">Email {isMissing('contact.email') && <span className="required-badge">*</span>}</label>
          <input
            id="email"
            type="email"
            value={cvData.contact?.email || ''}
            onChange={(e) => handleInputChange('contact.email', e.target.value)}
            placeholder="your.email@example.com"
          />
        </div>

        <div className={`form-group ${highlightMissing('contact.adress')}`}>
          <label htmlFor="address">Address {isMissing('contact.adress') && <span className="required-badge">*</span>}</label>
          <input
            id="address"
            type="text"
            value={cvData.contact?.adress || ''}
            onChange={(e) => handleInputChange('contact.adress', e.target.value)}
            placeholder="Your address"
          />
        </div>

        <div className="form-group">
          <label htmlFor="linkedin">LinkedIn</label>
          <input
            id="linkedin"
            type="url"
            value={cvData.contact?.linkedin || ''}
            onChange={(e) => handleInputChange('contact.linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>

        <div className="form-group">
          <label htmlFor="github">GitHub</label>
          <input
            id="github"
            type="url"
            value={cvData.contact?.github || ''}
            onChange={(e) => handleInputChange('contact.github', e.target.value)}
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
            onChange={(e) => handleInputChange('Profile', e.target.value)}
            placeholder="Write a brief professional summary..."
            rows="4"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Skills</h3>
        <div className="form-group">
          <label htmlFor="languages">Programming Languages</label>
          <input
            id="languages"
            type="text"
            value={(cvData.skills?.programmingLanguages || []).join(', ')}
            onChange={(e) =>
              handleInputChange('skills.programmingLanguages', e.target.value.split(',').map((l) => l.trim()))
            }
            placeholder="e.g., Python, JavaScript, TypeScript"
          />
        </div>

        <div className="form-group">
          <label htmlFor="frameworks">Frameworks</label>
          <input
            id="frameworks"
            type="text"
            value={(cvData.skills?.frameworks || []).join(', ')}
            onChange={(e) =>
              handleInputChange('skills.frameworks', e.target.value.split(',').map((f) => f.trim()))
            }
            placeholder="e.g., React, Vue, Angular"
          />
        </div>
      </div>

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
  );
}

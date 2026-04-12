import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCvUpdates, getMissingRequiredFields, normalizeCvData } from './cvSchema.js';

const completeCv = {
  personalInfo: {
    name: 'Tijn Gommers',
    Birthdate: '16/07/2005'
  },
  contact: {
    phonenumber: '+32123456789',
    email: 'tijn@example.com',
    adress: 'Leuven'
  },
  Profile: 'Computer science student with strong interest in AI.',
  Work_experience: {
    'PAL tutor': {
      company: 'VTK Leuven',
      period: '2025',
      description: 'Tutored first-year students.'
    }
  },
  Education: {
    '2023-2026': {
      institution: 'KU Leuven',
      degree: 'Bachelor in Computer Science'
    }
  }
};

test('normalizeCvData returns full normalized shape', () => {
  const normalized = normalizeCvData({ personalInfo: { name: 'A' } });

  assert.equal(typeof normalized, 'object');
  assert.equal(typeof normalized.personalInfo, 'object');
  assert.equal(typeof normalized.contact, 'object');
  assert.ok(Array.isArray(normalized.skills.programmingLanguages));
  assert.ok(Array.isArray(normalized.Hobbies));
  assert.equal(typeof normalized.Work_experience, 'object');
  assert.equal(typeof normalized.Education, 'object');
});

test('strict required fields are flagged when missing', () => {
  const missing = getMissingRequiredFields({});

  assert.deepEqual(missing, [
    'personalInfo.name',
    'personalInfo.Birthdate',
    'contact.phonenumber',
    'contact.email',
    'contact.adress',
    'Profile',
    'Work_experience',
    'Education'
  ]);
});

test('required fields pass when complete CV data is present', () => {
  const missing = getMissingRequiredFields(completeCv);
  assert.deepEqual(missing, []);
});

test('applyCvUpdates merges nested data and preserves normalized shape', () => {
  const updated = applyCvUpdates(
    { ...completeCv, Profile: '' },
    {
      Profile: 'Updated profile',
      contact: { email: 'new@example.com' }
    }
  );

  assert.equal(updated.Profile, 'Updated profile');
  assert.equal(updated.contact.email, 'new@example.com');
  assert.equal(updated.contact.phonenumber, completeCv.contact.phonenumber);
  assert.deepEqual(getMissingRequiredFields(updated), []);
});

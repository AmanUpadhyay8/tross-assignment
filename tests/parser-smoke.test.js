import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractOrganizationFromMeta,
  findHeaderSection,
  isSingleExperienceDate,
  matchesDetailSection,
  parseEducation,
  parseHeader,
  parseLanguages,
  parseSkills,
  parserVersion,
  splitDateDuration,
} from '../src/scraper/linkedin-extractor.js';

test('the production parser identifies itself as the resilient v12 parser', () => {
  assert.equal(parserVersion, 'v12');
});

test('header selection supports the alternate profile layout', () => {
  const alternate = {
    primaryHeading: 'Profile',
    headings: ['Aman Upadhyay', 'Profile'],
    text: 'Profile actions\nAman Upadhyay\nFull-Stack Developer\nBhubaneswar, Odisha, India',
    links: [],
    images: [],
  };

  assert.equal(findHeaderSection([alternate], 'Aman Upadhyay'), alternate);
});

test('detail selection uses semantic headings instead of a text prefix', () => {
  assert.equal(
    matchesDetailSection(
      {
        headings: ['Aman Upadhyay’s Experience'],
        text: 'Aman Upadhyay\nProgrammer Analyst Trainee',
      },
      'Experience',
    ),
    true,
  );
  assert.equal(
    matchesDetailSection(
      { headings: ['Education (2)'], text: 'Profile details' },
      'Education',
    ),
    true,
  );
});

test('header parsing skips relationship metadata', () => {
  const header = parseHeader(
    {
      primaryHeading: 'Example Person',
      text: [
        'Example Person',
        'she/her',
        '2nd',
        'Software Engineer',
        'Bengaluru, Karnataka, India',
        'Contact info',
        'Example Co',
        '500+ connections',
      ].join('\n'),
      images: [
        { src: 'https://media.example/profile-displayphoto.jpg', width: 400 },
        {
          src: 'https://media.example/profile-displaybackgroundimage.jpg',
          width: 1200,
        },
      ],
    },
    'https://www.linkedin.com/in/example/',
  );

  assert.equal(header.headline, 'Software Engineer');
  assert.equal(header.location, 'Bengaluru, Karnataka, India');
  assert.equal(header.currentCompany, 'Example Co');
  assert.equal(
    header.images.profile,
    'https://media.example/profile-displayphoto.jpg',
  );
});

test('single-date experience and organization metadata retain v11 semantics', () => {
  assert.equal(isSingleExperienceDate('Sep 2024'), true);
  assert.deepEqual(splitDateDuration('Sep 2024 · 1 mo'), {
    dateRange: 'Sep 2024',
    duration: '1 mo',
  });
  assert.equal(
    extractOrganizationFromMeta(
      'Mission Deep Education Trust · Apprenticeship',
    ),
    'Mission Deep Education Trust',
  );
});

test('education fallback is gated by the expected count', () => {
  const section = {
    text: [
      'Education',
      'Linked University',
      'BSc Computer Science',
      '2016 - 2020',
      'Fallback Institute',
      'Diploma',
      '2021 - 2022',
      'Show all 2 educations',
    ].join('\n'),
    links: [
      {
        text: 'Linked University\nBSc Computer Science\n2016 - 2020',
        href: 'https://www.linkedin.com/school/linked-university/',
      },
    ],
  };

  assert.equal(parseEducation(section).length, 1);
  assert.equal(parseEducation(section, 2).length, 2);
});

test('skills filtering removes role associations unless independently confirmed', () => {
  const section = {
    text: 'Skills\nLanguages\nJavaScript\nSoftware Engineer at Example Co\nSpend Wise - Personal Expense Tracker\nEndorsed by Alice',
  };
  const context = {
    experience: [
      { company: 'Example Co', roles: [{ title: 'Software Engineer' }] },
    ],
    education: [],
    certifications: [],
    confirmedSkills: new Set(),
  };
  assert.deepEqual(parseSkills(section, context).skills, ['JavaScript']);

  context.confirmedSkills.add('software engineer at example co');
  assert.deepEqual(parseSkills(section, context).skills, [
    'JavaScript',
    'Software Engineer at Example Co',
  ]);
});

test('languages preserve populated language and proficiency pairs', () => {
  assert.deepEqual(
    parseLanguages({
      text: 'Languages\nEnglish\nNative or bilingual proficiency\nHindi\nProfessional working proficiency',
    }),
    [
      { language: 'English', proficiency: 'Native or bilingual proficiency' },
      { language: 'Hindi', proficiency: 'Professional working proficiency' },
    ],
  );
  assert.deepEqual(
    parseLanguages({ text: 'Languages\nNothing to see for now' }),
    [],
  );
});

/**
 * Initial CV data structure
 * This serves as the default data when the app loads
 * Users can start with this data or create their own
 */

export const CV = {
  photo: '/profile-picture.jpg',

  personalInfo: {
    name: 'Your Name',
    Birthdate: 'DD/MM/YYYY'
  },

  contact: {
    phonenumber: '+1 (234) 567-8900',
    email: 'your.email@example.com',
    adress: 'City, State/Country',
    linkedin: 'https://linkedin.com/in/yourprofile',
    github: 'https://github.com/yourprofile'
  },

  Profile: 'A brief professional summary about yourself...',

  Work_experience: {
    'Role Title': {
      company: 'Company Name',
      period: '2024-2025',
      description: 'Brief description of your responsibilities and achievements'
    }
  },

  Education: {
    '2024-2026': {
      institution: 'University Name',
      degree: 'Degree Type',
      period: '2024-2026'
    }
  },

  skills: {
    programmingLanguages: ['JavaScript', 'Python', 'TypeScript'],
    frameworks: ['React', 'Node.js', 'Express']
  },

  languages: {
    English: 'Fluent',
    'Your Other Language': 'Level'
  },

  Hackathons: {
    'Hackathon Name': {
      date: '2024',
      description: 'Description of your participation and achievements'
    }
  },

  Prizes: {
    'Award Name': {
      date: '2024',
      description: 'Details about the award or recognition'
    }
  },

  Hobbies: ['Reading', 'Coding', 'Your Interests']
};

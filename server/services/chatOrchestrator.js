import { applyCvUpdates, getFollowUpQuestion, getMissingRequiredFields, normalizeCvData } from '../schemas/cvSchema.js';

export function buildAssistantTurn({ session, userMessage = '', updates = {} }) {
  const normalizedSessionData = normalizeCvData(session.cvData);
  const nextCvData = applyCvUpdates(normalizedSessionData, updates);
  const missingRequiredFields = getMissingRequiredFields(nextCvData);

  const assistantText = missingRequiredFields.length
    ? getFollowUpQuestion(missingRequiredFields)
    : 'Perfect. We now have all required information. I can continue refining your resume details and formatting.';

  const now = new Date().toISOString();

  return {
    cvData: nextCvData,
    missingRequiredFields,
    events: [
      {
        type: 'user_message',
        payload: {
          text: userMessage,
          timestamp: now
        }
      },
      {
        type: 'cv_data_updated',
        payload: {
          cvData: nextCvData,
          missingRequiredFields
        }
      },
      {
        type: 'assistant_message',
        payload: {
          text: assistantText,
          timestamp: now,
          requiredFieldsComplete: missingRequiredFields.length === 0
        }
      }
    ]
  };
}

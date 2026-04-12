import Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { applyCvUpdates, getFollowUpQuestion, getMissingRequiredFields, normalizeCvData } from '../schemas/cvSchema.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest';
const CLAUDE_MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 360);

const OrchestrationState = Annotation.Root({
  session: Annotation(),
  userMessage: Annotation(),
  updates: Annotation(),
  replaceMode: Annotation(),
  extractedUpdates: Annotation(),
  cvData: Annotation(),
  missingRequiredFields: Annotation(),
  assistantText: Annotation(),
  timestamp: Annotation()
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeUpdates(base, incoming) {
  if (!isPlainObject(base)) {
    return isPlainObject(incoming) ? { ...incoming } : {};
  }
  if (!isPlainObject(incoming)) {
    return { ...base };
  }

  const merged = { ...base };

  Object.entries(incoming).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeUpdates(merged[key], value);
      return;
    }

    merged[key] = value;
  });

  return merged;
}

function getClaudeClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractTextFromClaudeResponse(response) {
  if (!response || !Array.isArray(response.content)) {
    return '';
  }

  return response.content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

function getFallbackAssistantText(missingRequiredFields) {
  if (missingRequiredFields.length) {
    return getFollowUpQuestion(missingRequiredFields);
  }

  return 'Perfect. We now have all required information. I can continue refining your resume details and formatting.';
}

function extractJsonObjectFromText(text = '') {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      const parsed = JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function getHeuristicUpdatesFromMessage(message = '', currentCvData = {}) {
  if (typeof message !== 'string' || !message.trim()) {
    return {};
  }

  const normalized = normalizeCvData(currentCvData);
  const updates = {};
  const nameMatch = message.match(/(?:my name is|name\s*[:\-])\s*([^,.\n]+)/i);
  const birthdateMatch = message.match(/(?:birthdate|date of birth|dob)\s*[:\-]?\s*([^,.\n]+)/i);
  const emailMatch = message.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const phoneMatch = message.match(/(?:phone|phonenumber|number|tel)\s*[:\-]?\s*([+()\d\s-]{7,})/i);
  const addressMatch = message.match(/(?:address|adress)\s*[:\-]\s*([^\n]+)/i);
  const linkedinMatch = message.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+/i);
  const githubMatch = message.match(/https?:\/\/(?:www\.)?github\.com\/[^\s,]+/i);
  const addHobbyMatch = message.match(/(?:add hobby|hobby\s*[:\-])\s*([^,.\n]+)/i);
  const removeHobbyMatch = message.match(/remove hobby\s*[:\-]?\s*([^,.\n]+)/i);
  const addLanguageMatch = message.match(/add (?:programming )?language\s*[:\-]?\s*([^,.\n]+)/i);
  const removeLanguageMatch = message.match(/remove (?:programming )?language\s*[:\-]?\s*([^,.\n]+)/i);
  const addFrameworkMatch = message.match(/add framework\s*[:\-]?\s*([^,.\n]+)/i);
  const removeFrameworkMatch = message.match(/remove framework\s*[:\-]?\s*([^,.\n]+)/i);
  const removeWorkMatch = message.match(/remove work experience\s*[:\-]?\s*([^\n]+)/i);
  const removeEducationMatch = message.match(/remove education\s*[:\-]?\s*([^\n]+)/i);
  const removeHackathonMatch = message.match(/remove hackathon\s*[:\-]?\s*([^\n]+)/i);
  const removePrizeMatch = message.match(/remove prize\s*[:\-]?\s*([^\n]+)/i);
  const removeDegreeMatch = message.match(/remove (?:degree|certification)\s*[:\-]?\s*([^\n]+)/i);
  const spokenLanguageMatch = message.match(/(?:i speak|language)\s+([^,.\n]+?)\s*(?:at|level)?\s*(native|fluent|basic|intermediate|advanced|a1|a2|b1|b2|c1|c2)?/i);

  if (nameMatch) {
    updates.personalInfo = { ...(updates.personalInfo || {}), name: nameMatch[1].trim() };
  }
  if (birthdateMatch) {
    updates.personalInfo = { ...(updates.personalInfo || {}), Birthdate: birthdateMatch[1].trim() };
  }
  if (emailMatch) {
    updates.contact = { ...(updates.contact || {}), email: emailMatch[1].trim() };
  }
  if (phoneMatch) {
    updates.contact = { ...(updates.contact || {}), phonenumber: phoneMatch[1].trim() };
  }
  if (addressMatch) {
    updates.contact = { ...(updates.contact || {}), adress: addressMatch[1].trim() };
  }
  if (linkedinMatch) {
    updates.contact = { ...(updates.contact || {}), linkedin: linkedinMatch[0].trim() };
  }
  if (githubMatch) {
    updates.contact = { ...(updates.contact || {}), github: githubMatch[0].trim() };
  }

  if (addHobbyMatch) {
    const hobby = addHobbyMatch[1].trim();
    if (hobby) {
      const nextHobbies = [...normalized.Hobbies];
      if (!nextHobbies.includes(hobby)) {
        nextHobbies.push(hobby);
      }
      updates.Hobbies = nextHobbies;
    }
  }

  if (removeHobbyMatch) {
    const hobby = removeHobbyMatch[1].trim().toLowerCase();
    updates.Hobbies = normalized.Hobbies.filter((item) => item.toLowerCase() !== hobby);
  }

  if (addLanguageMatch) {
    const language = addLanguageMatch[1].trim();
    if (language) {
      const nextLanguages = [...normalized.skills.programmingLanguages];
      if (!nextLanguages.includes(language)) {
        nextLanguages.push(language);
      }
      updates.skills = { ...(updates.skills || {}), programmingLanguages: nextLanguages };
    }
  }

  if (removeLanguageMatch) {
    const language = removeLanguageMatch[1].trim().toLowerCase();
    updates.skills = {
      ...(updates.skills || {}),
      programmingLanguages: normalized.skills.programmingLanguages.filter((item) => item.toLowerCase() !== language)
    };
  }

  if (addFrameworkMatch) {
    const framework = addFrameworkMatch[1].trim();
    if (framework) {
      const nextFrameworks = [...normalized.skills.frameworks];
      if (!nextFrameworks.includes(framework)) {
        nextFrameworks.push(framework);
      }
      updates.skills = { ...(updates.skills || {}), frameworks: nextFrameworks };
    }
  }

  if (removeFrameworkMatch) {
    const framework = removeFrameworkMatch[1].trim().toLowerCase();
    updates.skills = {
      ...(updates.skills || {}),
      frameworks: normalized.skills.frameworks.filter((item) => item.toLowerCase() !== framework)
    };
  }

  if (removeWorkMatch) {
    const label = removeWorkMatch[1].trim();
    updates.Work_experience = { ...(updates.Work_experience || {}), [label]: null };
  }

  if (removeEducationMatch) {
    const label = removeEducationMatch[1].trim();
    updates.Education = { ...(updates.Education || {}), [label]: null };
  }

  if (removeHackathonMatch) {
    const label = removeHackathonMatch[1].trim();
    updates.Hackathons = { ...(updates.Hackathons || {}), [label]: null };
  }

  if (removePrizeMatch) {
    const label = removePrizeMatch[1].trim();
    updates.Prizes = { ...(updates.Prizes || {}), [label]: null };
  }

  if (removeDegreeMatch) {
    const label = removeDegreeMatch[1].trim();
    updates.Degrees = { ...(updates.Degrees || {}), [label]: null };
  }

  if (spokenLanguageMatch) {
    const languageName = spokenLanguageMatch[1]?.trim();
    const level = spokenLanguageMatch[2]?.trim() || 'fluent';
    if (languageName) {
      updates.languages = {
        ...(updates.languages || {}),
        [languageName]: level
      };
    }
  }

  return updates;
}

async function extractUpdatesNode(state) {
  const userMessage = typeof state.userMessage === 'string' ? state.userMessage.trim() : '';
  const incomingUpdates = isPlainObject(state.updates) ? state.updates : {};
  const replaceMode = state.replaceMode === true;

  if (replaceMode) {
    return {
      extractedUpdates: incomingUpdates
    };
  }

  if (!userMessage) {
    return {
      extractedUpdates: incomingUpdates
    };
  }

  const claude = getClaudeClient();
  if (!claude) {
    return {
      extractedUpdates: mergeUpdates(getHeuristicUpdatesFromMessage(userMessage, state.session?.cvData || {}), incomingUpdates)
    };
  }

  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      temperature: 0,
      system: [
        'Extract only CV field updates from the user message.',
        'Return only strict JSON object and no markdown.',
        'If no concrete field update exists, return {}.',
        'Allowed keys: photo, personalInfo, contact, Profile, skills, languages, Hobbies, Work_experience, Education, Hackathons, Prizes, Degrees.',
        'For arrays (for example Hobbies or skills arrays), return the full new array value when changing it.',
        'To remove a specific object entry, set that entry key to null (for example Work_experience.{"Old Role": null}).',
        'To remove scalar values, set the field to an empty string.'
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                userMessage,
                currentCvData: normalizeCvData(state.session?.cvData || {}),
                explicitUpdates: incomingUpdates
              })
            }
          ]
        }
      ]
    });

    const modelText = extractTextFromClaudeResponse(response);
    const parsedUpdates = extractJsonObjectFromText(modelText) || {};

    return {
      extractedUpdates: mergeUpdates(parsedUpdates, incomingUpdates)
    };
  } catch {
    return {
      extractedUpdates: mergeUpdates(getHeuristicUpdatesFromMessage(userMessage, state.session?.cvData || {}), incomingUpdates)
    };
  }
}

async function applyUpdatesNode(state) {
  const normalizedSessionData = normalizeCvData(state.session?.cvData || {});
  const replaceMode = state.replaceMode === true;
  const nextCvData = replaceMode
    ? normalizeCvData(state.extractedUpdates || {})
    : applyCvUpdates(normalizedSessionData, state.extractedUpdates || state.updates || {});
  const missingRequiredFields = getMissingRequiredFields(nextCvData);

  return {
    cvData: nextCvData,
    missingRequiredFields,
    timestamp: new Date().toISOString()
  };
}

async function draftAssistantNode(state) {
  const claude = getClaudeClient();

  if (!claude) {
    return {
      assistantText: getFallbackAssistantText(state.missingRequiredFields || [])
    };
  }

  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      temperature: 0.3,
      system: [
        'You are a CV assistant helping collect and refine resume information.',
        'The required-field validation is authoritative and already computed for you.',
        'When required fields are missing, keep your response concise and request only the next missing required field.',
        'When required fields are complete, acknowledge completion and suggest the next improvement step.'
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                userMessage: state.userMessage || '',
                cvData: state.cvData,
                missingRequiredFields: state.missingRequiredFields,
                nextRequiredQuestion: getFollowUpQuestion(state.missingRequiredFields || [])
              })
            }
          ]
        }
      ]
    });

    const assistantText = extractTextFromClaudeResponse(response);

    return {
      assistantText: assistantText || getFallbackAssistantText(state.missingRequiredFields || [])
    };
  } catch {
    return {
      assistantText: getFallbackAssistantText(state.missingRequiredFields || [])
    };
  }
}

async function enforceRequiredFieldsNode(state) {
  const missingRequiredFields = state.missingRequiredFields || [];
  const fallbackQuestion = getFollowUpQuestion(missingRequiredFields);
  const rawText = typeof state.assistantText === 'string' ? state.assistantText.trim() : '';

  if (!missingRequiredFields.length) {
    return {
      assistantText: rawText || getFallbackAssistantText(missingRequiredFields)
    };
  }

  if (!rawText) {
    return {
      assistantText: fallbackQuestion
    };
  }

  if (rawText.includes(fallbackQuestion)) {
    return {
      assistantText: rawText
    };
  }

  return {
    assistantText: `${rawText}\n\n${fallbackQuestion}`
  };
}

const assistantGraph = new StateGraph(OrchestrationState)
  .addNode('extract_updates', extractUpdatesNode)
  .addNode('apply_updates', applyUpdatesNode)
  .addNode('draft_assistant_message', draftAssistantNode)
  .addNode('enforce_required_fields', enforceRequiredFieldsNode)
  .addEdge(START, 'extract_updates')
  .addEdge('extract_updates', 'apply_updates')
  .addEdge('apply_updates', 'draft_assistant_message')
  .addEdge('draft_assistant_message', 'enforce_required_fields')
  .addEdge('enforce_required_fields', END)
  .compile();

export async function buildAssistantTurn({ session, userMessage = '', updates = {}, replaceMode = false }) {
  const finalState = await assistantGraph.invoke({
    session,
    userMessage,
    updates,
    replaceMode
  });

  const now = finalState.timestamp || new Date().toISOString();

  return {
    cvData: finalState.cvData,
    missingRequiredFields: finalState.missingRequiredFields,
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
          cvData: finalState.cvData,
          missingRequiredFields: finalState.missingRequiredFields
        }
      },
      {
        type: 'assistant_message',
        payload: {
          text: finalState.assistantText,
          timestamp: now,
          requiredFieldsComplete: finalState.missingRequiredFields.length === 0
        }
      }
    ]
  };
}

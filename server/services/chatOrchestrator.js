import Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { applyCvUpdates, getFollowUpQuestion, getMissingRequiredFields, normalizeCvData } from '../schemas/cvSchema.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest';
const CLAUDE_MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 360);

const OrchestrationState = Annotation.Root({
  session: Annotation(),
  userMessage: Annotation(),
  updates: Annotation(),
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

function getHeuristicUpdatesFromMessage(message = '') {
  if (typeof message !== 'string' || !message.trim()) {
    return {};
  }

  const updates = {};
  const nameMatch = message.match(/(?:my name is|name\s*[:\-])\s*([^,.\n]+)/i);
  const birthdateMatch = message.match(/(?:birthdate|date of birth|dob)\s*[:\-]?\s*([^,.\n]+)/i);
  const emailMatch = message.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const phoneMatch = message.match(/(?:phone|phonenumber|number|tel)\s*[:\-]?\s*([+()\d\s-]{7,})/i);
  const addressMatch = message.match(/(?:address|adress)\s*[:\-]\s*([^\n]+)/i);
  const linkedinMatch = message.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+/i);
  const githubMatch = message.match(/https?:\/\/(?:www\.)?github\.com\/[^\s,]+/i);

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

  return updates;
}

async function extractUpdatesNode(state) {
  const userMessage = typeof state.userMessage === 'string' ? state.userMessage.trim() : '';
  const incomingUpdates = isPlainObject(state.updates) ? state.updates : {};

  if (!userMessage) {
    return {
      extractedUpdates: incomingUpdates
    };
  }

  const claude = getClaudeClient();
  if (!claude) {
    return {
      extractedUpdates: mergeUpdates(getHeuristicUpdatesFromMessage(userMessage), incomingUpdates)
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
        'Allowed keys: personalInfo.name, personalInfo.Birthdate, contact.phonenumber, contact.email, contact.adress, contact.linkedin, contact.github, Profile, skills.programmingLanguages, skills.frameworks, Work_experience, Education, Hobbies.'
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
      extractedUpdates: mergeUpdates(getHeuristicUpdatesFromMessage(userMessage), incomingUpdates)
    };
  }
}

async function applyUpdatesNode(state) {
  const normalizedSessionData = normalizeCvData(state.session?.cvData || {});
  const nextCvData = applyCvUpdates(normalizedSessionData, state.extractedUpdates || state.updates || {});
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

export async function buildAssistantTurn({ session, userMessage = '', updates = {} }) {
  const finalState = await assistantGraph.invoke({
    session,
    userMessage,
    updates
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

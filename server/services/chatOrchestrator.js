import Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { validateLatexSyntax } from './latexValidator.js';
import { DEFAULT_LATEX_TEMPLATE } from '../../shared/defaultLatexTemplate.js';
import { createLogger } from '../utils/logger.js';
import { createDefaultResumeData } from './resumeSchema.js';
import { validateResumeOperations } from './resumeValidator.js';
import { applyResumeOperations } from './resumeOperationApplier.js';
import { translateResumeDataToLatex } from './resumeLatexTranslator.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-1-20250805';
const CLAUDE_MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 900);
const CONTEXT_TURNS_LIMIT = Number(process.env.CONTEXT_TURNS_LIMIT || 4);
const ICON_COMMAND_REGEX = /\\fa[A-Z][a-zA-Z]*\*?/g;
const logger = createLogger('chatOrchestrator');

const BASELINE_LATEX_OUTLINE = DEFAULT_LATEX_TEMPLATE;

const OrchestrationState = Annotation.Root({
  session: Annotation(),
  userMessage: Annotation(),
  conversationHistory: Annotation(),
  latexSource: Annotation(),
  feedback: Annotation(),
  validationError: Annotation(),
  timestamp: Annotation(),
  shouldPersistLatex: Annotation(),
  requestId: Annotation()
});

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

function normalizeJsonPayload(text = '') {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function resolveOperationMode() {
  const rawValue = process.env.USE_OPERATION_MODE;
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
  const isValid = normalizedValue === '0' || normalizedValue === '1';

  return {
    enabled: normalizedValue === '1',
    rawValue: rawValue ?? '',
    normalizedValue,
    isValid
  };
}

function logRawModelOutput(requestLogger, eventPrefix, rawText, rawResponse) {
  const text = typeof rawText === 'string' ? rawText : '';
  const chunkSize = 1800;
  const totalChunks = Math.max(1, Math.ceil(text.length / chunkSize));

  requestLogger.info(`${eventPrefix}.start`, {
    responseLength: text.length,
    totalChunks
  });

  if (text.length === 0) {
    requestLogger.info(`${eventPrefix}.chunk`, {
      chunkIndex: 1,
      totalChunks,
      rawModelOutputChunk: ''
    });
  } else {
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = start + chunkSize;
      const chunk = text.slice(start, end);
      requestLogger.info(`${eventPrefix}.chunk`, {
        chunkIndex: index + 1,
        totalChunks,
        rawModelOutputChunk: chunk
      });
    }
  }

  requestLogger.info(`${eventPrefix}.full_response_json`, {
    rawModelOutputJson: safeStringify(rawResponse)
  });

  requestLogger.info(`${eventPrefix}.end`, {
    responseLength: text.length,
    totalChunks
  });
}

function hasResetIntent(userMessage = '') {
  return /(reset|rewrite|start over|from scratch|opnieuw|helemaal opnieuw)/i.test(userMessage);
}

function extractIconCommands(latexSource = '') {
  if (!latexSource || typeof latexSource !== 'string') {
    return new Set();
  }

  return new Set(latexSource.match(ICON_COMMAND_REGEX) || []);
}

function buildFallbackLatex(currentLatex, userMessage) {
  const base = (typeof currentLatex === 'string' && currentLatex.trim()) || BASELINE_LATEX_OUTLINE;
  const insertion = `% User requested: ${userMessage || 'No additional details provided.'}`;

  if (base.includes('\\end{document}')) {
    return base.replace('\\end{document}', `${insertion}\n\\end{document}`);
  }

  return `${base}\n${insertion}`;
}

function extractOperationPayload(responseText = '') {
  const normalized = normalizeJsonPayload(responseText);
  const parsed = JSON.parse(normalized);

  return {
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback.trim() : 'Updated resume sections.',
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.filter((item) => typeof item === 'string') : [],
    operations: Array.isArray(parsed.operations) ? parsed.operations : []
  };
}

async function buildAssistantTurnFromOperations({ session, userMessage = '', requestId = 'unknown' }) {
  const requestLogger = logger.child({ requestId });
  const startTime = Date.now();
  const claude = getClaudeClient();
  const resumeData = session?.resumeData || createDefaultResumeData();

  requestLogger.info('assistant_turn_operations.start', {
    sessionId: session?.id || 'unknown',
    messageLength: userMessage.length,
    historyCount: Array.isArray(session?.messages) ? session.messages.length : 0
  });

  if (!claude) {
    requestLogger.warn('assistant_turn_operations.no_api_key', {
      reasonCode: 'NO_API_KEY'
    });

    return {
      latexSource: session?.latexSource || DEFAULT_LATEX_TEMPLATE,
      resumeData,
      operationsApplied: [],
      validationError: null,
      events: [
        {
          type: 'user_message',
          payload: { text: userMessage, timestamp: new Date().toISOString() }
        },
        {
          type: 'assistant_message',
          payload: {
            text: 'Operation mode is enabled, but no API key is configured. I kept your resume unchanged.',
            timestamp: new Date().toISOString(),
            isError: false,
            nextSteps: ['Add ANTHROPIC_API_KEY to enable operation generation.']
          }
        }
      ],
      shouldPersistLatex: false
    };
  }

  try {
    const conversationHistory = Array.isArray(session?.messages)
      ? session.messages.slice(-CONTEXT_TURNS_LIMIT).map((msg) => ({ role: msg.role, content: msg.content }))
      : [];

    const prompt = [
      'You update a resume using OPERATIONS ONLY. Never return LaTeX.',
      'Return ONLY valid JSON with this shape:',
      '{"feedback":"string","nextSteps":["string"],"operations":[{"operationId":"string","opType":"string","target":{},"payload":{}}]}',
      '',
      'Rules:',
      '- Prefer additive changes unless user asks to replace/remove.',
      '- Use only supported operation types: set_contact_field, add_contact_link, remove_contact_link, add_section, update_section_meta, toggle_section_visibility, reorder_sections, add_entry, update_entry, remove_entry, add_bullet, update_bullet, remove_bullet, add_topic_group, update_topic_group, remove_topic_group.',
      '- Include operationId for each operation (uuid-like string).',
      '- Never emit markdown fences or extra text outside JSON.',
      '',
      'Current resume JSON:',
      JSON.stringify(resumeData)
    ].join('\n');

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      temperature: 0.2,
      system: prompt,
      messages: [
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ]
    });

    const text = extractTextFromClaudeResponse(response);
    logRawModelOutput(requestLogger, 'assistant_turn_operations.raw_model_output', text, response);
    const payload = extractOperationPayload(text);
    const operationValidation = validateResumeOperations(payload.operations);
    if (!operationValidation.valid) {
      throw new Error(`Operation validation failed: ${JSON.stringify(operationValidation.errors)}`);
    }

    const applied = applyResumeOperations({
      resumeData,
      operations: payload.operations,
      requestId
    });

    const translatedLatex = translateResumeDataToLatex(applied.resumeData);
    const syntaxValidation = validateLatexSyntax(translatedLatex);
    if (!syntaxValidation.valid) {
      throw new Error(`Translated LaTeX failed validation: ${syntaxValidation.errors?.join('; ') || 'unknown error'}`);
    }

    const timestamp = new Date().toISOString();
    requestLogger.info('assistant_turn_operations.success', {
      durationMs: Date.now() - startTime,
      operationsApplied: payload.operations.length,
      latexLength: translatedLatex.length
    });

    const nextStepsText = payload.nextSteps.length > 0
      ? `\n\nNext steps:\n- ${payload.nextSteps.join('\n- ')}`
      : '';

    return {
      latexSource: translatedLatex,
      resumeData: applied.resumeData,
      operationsApplied: payload.operations,
      validationError: null,
      events: [
        {
          type: 'user_message',
          payload: { text: userMessage, timestamp }
        },
        {
          type: 'assistant_message',
          payload: {
            text: `${payload.feedback}${nextStepsText}`,
            latexSource: translatedLatex,
            timestamp,
            isError: false,
            operationsApplied: payload.operations.length,
            nextSteps: payload.nextSteps
          }
        }
      ],
      shouldPersistLatex: true
    };
  } catch (error) {
    requestLogger.error('assistant_turn_operations.failed', {
      error,
      reasonCode: 'OPERATION_MODE_FAILED',
      durationMs: Date.now() - startTime
    });

    const timestamp = new Date().toISOString();
    return {
      latexSource: session?.latexSource || DEFAULT_LATEX_TEMPLATE,
      resumeData,
      operationsApplied: [],
      validationError: error instanceof Error ? error.message : String(error),
      events: [
        {
          type: 'user_message',
          payload: { text: userMessage, timestamp }
        },
        {
          type: 'assistant_message',
          payload: {
            text: 'I could not apply structured operations safely, so I preserved your previous resume state.',
            timestamp,
            isError: true,
            nextSteps: ['Try a more specific instruction for one section at a time.']
          }
        }
      ],
      shouldPersistLatex: false
    };
  }
}

async function draftLatexNode(state) {
  const requestLogger = logger.child({ requestId: state.requestId || 'unknown' });
  const claude = getClaudeClient();
  const userMessage = typeof state.userMessage === 'string' ? state.userMessage.trim() : '';
  const conversationHistory = Array.isArray(state.conversationHistory)
    ? state.conversationHistory.slice(-CONTEXT_TURNS_LIMIT)
    : [];
  const session = state.session;

  if (!session) {
    requestLogger.error('draft_latex.session_missing', {
      reasonCode: 'SESSION_CONTEXT_MISSING'
    });
    return {
      latexSource: BASELINE_LATEX_OUTLINE,
      timestamp: new Date().toISOString(),
      feedback: 'Session state was missing. Restored to baseline resume outline.',
      validationError: 'Session context was unavailable during generation.',
      shouldPersistLatex: false
    };
  }

  const currentLatex = typeof session.latexSource === 'string' ? session.latexSource : '';

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content
    })),
    {
      role: 'user',
      content: userMessage
    }
  ];

  if (!claude) {
    requestLogger.warn('draft_latex.no_api_key_fallback', {
      reasonCode: 'NO_API_KEY',
      currentLatexLength: currentLatex.length
    });
    return {
      latexSource: buildFallbackLatex(currentLatex, userMessage),
      timestamp: new Date().toISOString(),
      feedback: 'Using fallback mode. Preserved your existing resume structure and noted your latest request.',
      shouldPersistLatex: true
    };
  }

  try {
    const startedAt = Date.now();
    requestLogger.info('draft_latex.api_call.start', {
      model: CLAUDE_MODEL,
      maxTokens: CLAUDE_MAX_TOKENS,
      historyTurns: conversationHistory.length,
      currentLatexLength: currentLatex.length
    });

    const systemPrompt = [
      'You are a professional resume writer and LaTeX expert.',
      'Your task is to incrementally build a resume by preserving existing content and adding new information.',
      '',
      'ABSOLUTELY CRITICAL - YOU MUST FOLLOW THESE RULES:',
      '1. PRESERVE the entire current resume document structure - DO NOT DELETE any existing content unless user explicitly asks for reset/rewrite.',
      '2. When user adds information, find the appropriate section and ADD to it (do not replace the whole document).',
      '3. Keep LaTeX structural anchors intact: \\documentclass, \\begin{document}, \\end{document}.',
      '4. Preserve icon-related commands if present: keep \\usepackage{fontawesome5}, \\faPhone, and \\faEnvelope unless user explicitly asks to remove icons.',
      '5. If current resume is incomplete/corrupt, use the baseline outline as structure and merge user-provided details.',
      '5. Return output ONLY as valid JSON (nothing else before or after).',
      '6. JSON format: {"feedback": "what changed + suggested next info", "latex": "<complete LaTeX code>"}.',
      '',
      'BASELINE OUTLINE (always available for structure):',
      '```',
      BASELINE_LATEX_OUTLINE,
      '```',
      '',
      'CURRENT RESUME (preserve and build upon this):',
      '```',
      currentLatex || '[Empty - initialize from baseline outline]',
      '```',
      '',
      'CONVERSATION CONTEXT: Use the provided message history to infer where new details belong.',
      'Do not remove previously added personal details unless user asks to replace them.'
    ].join('\n');

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      temperature: 0.3,
      system: systemPrompt,
      messages
    });
    requestLogger.info('draft_latex.api_call.success', {
      model: CLAUDE_MODEL,
      durationMs: Date.now() - startedAt,
      usage: response?.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cacheCreationInputTokens: response.usage.cache_creation_input_tokens,
            cacheReadInputTokens: response.usage.cache_read_input_tokens
          }
        : undefined
    });

    const fullResponse = extractTextFromClaudeResponse(response);
    logRawModelOutput(requestLogger, 'draft_latex.raw_model_output', fullResponse, response);
    requestLogger.debug('draft_latex.api_response.received', {
      responseLength: fullResponse.length
    });

    const normalizedResponse = normalizeJsonPayload(fullResponse);
    const parsed = JSON.parse(normalizedResponse);
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : 'Resume updated';
    const latexSource = typeof parsed.latex === 'string' ? parsed.latex.trim() : '';
    requestLogger.info('draft_latex.parse.success', {
      feedbackLength: feedback.length,
      latexLength: latexSource.length
    });

    return {
      latexSource,
      feedback,
      timestamp: new Date().toISOString(),
      shouldPersistLatex: true
    };
  } catch (error) {
    requestLogger.error('draft_latex.api_or_parse_failure', {
      error,
      reasonCode: 'API_OR_PARSE_FAILURE'
    });

    const message = error instanceof Error ? error.message : String(error);
    const shouldFallback = /credit balance is too low|invalid_request_error|timeout|network|rate limit|429|not valid json|unexpected token|json/i.test(message);

    if (shouldFallback) {
      requestLogger.warn('draft_latex.fallback_applied', {
        reasonCode: 'EXTERNAL_API_UNAVAILABLE',
        currentLatexLength: currentLatex.length
      });
      return {
        latexSource: buildFallbackLatex(currentLatex, userMessage),
        feedback: 'API unavailable right now. I kept your structure and captured your request so you can continue editing.',
        validationError: null,
        timestamp: new Date().toISOString(),
        shouldPersistLatex: true
      };
    }

    requestLogger.error('draft_latex.hard_failure_preserving_previous', {
      reasonCode: 'UNSAFE_UPDATE_REJECTED',
      currentLatexLength: currentLatex.length
    });
    return {
      latexSource: currentLatex || BASELINE_LATEX_OUTLINE,
      feedback: `Could not safely apply this update. Kept your previous resume unchanged. (${message})`,
      validationError: message,
      timestamp: new Date().toISOString(),
      shouldPersistLatex: false
    };
  }
}

async function validateLatexNode(state) {
  const requestLogger = logger.child({ requestId: state.requestId || 'unknown' });
  if (state.shouldPersistLatex === false) {
    requestLogger.warn('validate_latex.skip_requested', {
      reasonCode: 'PERSISTENCE_DISABLED_FROM_PREVIOUS_STEP',
      validationError: state.validationError || null
    });
    return {
      validationError: state.validationError || 'LaTeX update was rejected before validation.',
      latexSource: typeof state.latexSource === 'string' && state.latexSource.trim()
        ? state.latexSource
        : (typeof state.session?.latexSource === 'string' ? state.session.latexSource : BASELINE_LATEX_OUTLINE),
      feedback: state.feedback || 'Your previous resume was preserved due to an unsafe update.',
      shouldPersistLatex: false
    };
  }

  const latexSource = typeof state.latexSource === 'string' ? state.latexSource : '';
  const previousLatex = typeof state.session?.latexSource === 'string' ? state.session.latexSource : '';
  const userMessage = typeof state.userMessage === 'string' ? state.userMessage : '';
  const resetIntent = hasResetIntent(userMessage);

  if (!latexSource) {
    requestLogger.error('validate_latex.empty_source', {
      reasonCode: 'NO_LATEX_SOURCE'
    });
    return {
      validationError: 'No LaTeX source generated',
      latexSource: previousLatex || BASELINE_LATEX_OUTLINE,
      feedback: state.feedback || 'No valid update generated. Kept previous resume unchanged.',
      shouldPersistLatex: false
    };
  }

  const validation = validateLatexSyntax(latexSource);
  if (!validation.valid) {
    requestLogger.warn('validate_latex.syntax_failed', {
      reasonCode: 'SYNTAX_VALIDATION_FAILED',
      errorCount: validation.errors?.length || 0,
      warningCount: validation.warnings?.length || 0
    });
    return {
      validationError: validation.errors?.join('; ') || 'LaTeX syntax error',
      latexSource: previousLatex || BASELINE_LATEX_OUTLINE,
      feedback: 'Generated LaTeX failed validation, so your previous resume was preserved.',
      shouldPersistLatex: false
    };
  }

  if (previousLatex && !resetIntent) {
    const previousIcons = extractIconCommands(previousLatex);
    const candidateIcons = extractIconCommands(latexSource);
    const missingIcons = [...previousIcons].filter((icon) => !candidateIcons.has(icon));

    const previousHasFontAwesome = previousLatex.includes('\\usepackage{fontawesome5}');
    const candidateHasFontAwesome = latexSource.includes('\\usepackage{fontawesome5}');

    if ((previousHasFontAwesome && !candidateHasFontAwesome) || missingIcons.length > 0) {
      requestLogger.warn('validate_latex.icon_loss_rejected', {
        reasonCode: 'ICON_FORMATTING_LOSS',
        missingIcons
      });
      return {
        validationError: `Candidate LaTeX lost icon commands: ${missingIcons.join(', ') || 'fontawesome5 package removed'}.`,
        latexSource: previousLatex,
        feedback: 'I preserved your previous resume because icon formatting was removed in the generated update.',
        shouldPersistLatex: false
      };
    }

    const shrinkRatio = previousLatex.length > 0 ? latexSource.length / previousLatex.length : 1;
    if (shrinkRatio < 0.7) {
      requestLogger.warn('validate_latex.unexpected_shrink_rejected', {
        reasonCode: 'UNEXPECTED_CONTENT_SHRINK',
        shrinkRatio: Number(shrinkRatio.toFixed(2))
      });
      return {
        validationError: `Candidate LaTeX shrank unexpectedly (ratio: ${shrinkRatio.toFixed(2)}).`,
        latexSource: previousLatex,
        feedback: 'I preserved your previous resume because the generated update looked incomplete.',
        shouldPersistLatex: false
      };
    }
  }

  requestLogger.info('validate_latex.accepted', {
    reasonCode: 'VALIDATION_ACCEPTED',
    latexLength: latexSource.length
  });
  return {
    validationError: null,
    latexSource,
    feedback: state.feedback || '',
    shouldPersistLatex: true
  };
}

const orchestrationGraph = new StateGraph(OrchestrationState)
  .addNode('draft_latex', draftLatexNode)
  .addNode('validate_latex', validateLatexNode)
  .addEdge(START, 'draft_latex')
  .addEdge('draft_latex', 'validate_latex')
  .addEdge('validate_latex', END)
  .compile();

export async function buildAssistantTurn({ session, userMessage = '', requestId = 'unknown' }) {
  const requestLogger = logger.child({ requestId });
  const mode = resolveOperationMode();

  requestLogger.info('assistant_turn.mode_selected', {
    mode: mode.enabled ? 'operation' : 'legacy_latex',
    rawUseOperationMode: mode.rawValue,
    normalizedUseOperationMode: mode.normalizedValue,
    validUseOperationMode: mode.isValid
  });

  if (!mode.isValid) {
    requestLogger.warn('assistant_turn.mode_invalid_env', {
      reasonCode: 'INVALID_USE_OPERATION_MODE',
      rawUseOperationMode: mode.rawValue,
      normalizedUseOperationMode: mode.normalizedValue,
      expectedValues: '0|1'
    });
  }

  if (mode.enabled) {
    return buildAssistantTurnFromOperations({ session, userMessage, requestId });
  }

  const startTime = Date.now();
  requestLogger.info('assistant_turn.start', {
    sessionId: session?.id || 'unknown',
    messageLength: userMessage.length,
    historyCount: Array.isArray(session?.messages) ? session.messages.length : 0
  });

  const conversationHistory = (session?.messages || []).map((msg) => ({
    role: msg.role || 'user',
    content: msg.content || ''
  }));

  const finalState = await orchestrationGraph.invoke({
    session,
    userMessage,
    conversationHistory,
    latexSource: '',
    validationError: null,
    shouldPersistLatex: true,
    requestId
  });

  const now = finalState.timestamp || new Date().toISOString();
  const hasError = Boolean(finalState.validationError);

  requestLogger.info('assistant_turn.end', {
    durationMs: Date.now() - startTime,
    hasError,
    shouldPersistLatex: Boolean(finalState.shouldPersistLatex),
    latexLength: finalState.latexSource?.length || 0,
    feedbackLength: finalState.feedback?.length || 0
  });

  const events = [
    {
      type: 'user_message',
      payload: {
        text: userMessage,
        timestamp: now
      }
    }
  ];

  if (hasError) {
    events.push({
      type: 'assistant_message',
      payload: {
        text: finalState.feedback || `Error generating resume: ${finalState.validationError}`,
        timestamp: now,
        isError: true
      }
    });
  } else {
    events.push({
      type: 'assistant_message',
      payload: {
        text: finalState.feedback || 'Resume updated successfully',
        latexSource: finalState.latexSource,
        timestamp: now,
        isError: false
      }
    });
  }

  return {
    latexSource: finalState.latexSource,
    validationError: finalState.validationError,
    events,
    shouldPersistLatex: Boolean(finalState.shouldPersistLatex)
  };
}

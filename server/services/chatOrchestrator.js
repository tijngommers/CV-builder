import Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { validateLatexSyntax } from './latexValidator.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-1-20250805';
const CLAUDE_MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 2000);
const CONTEXT_TURNS_LIMIT = 10;

const BASELINE_LATEX_OUTLINE = String.raw`\documentclass{article}
\usepackage[empty]{fullpage}
\pagestyle{empty}
\begin{document}
\section*{CONTACT}
[Full Name]
[Email] | [Phone] | [Location]

\section*{SUMMARY}
[Professional summary]

\section*{EXPERIENCE}
\textbf{Job Title} -- Company \hfill [Dates]
\begin{itemize}
  \item [Achievement or responsibility]
\end{itemize}

\section*{EDUCATION}
\textbf{Degree} -- Institution \hfill [Dates]

\section*{SKILLS}
[Technical skills, tools, languages]
\end{document}`;

const OrchestrationState = Annotation.Root({
  session: Annotation(),
  userMessage: Annotation(),
  conversationHistory: Annotation(),
  latexSource: Annotation(),
  feedback: Annotation(),
  validationError: Annotation(),
  timestamp: Annotation(),
  shouldPersistLatex: Annotation()
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

function hasResetIntent(userMessage = '') {
  return /(reset|rewrite|start over|from scratch|opnieuw|helemaal opnieuw)/i.test(userMessage);
}

function buildFallbackLatex(currentLatex, userMessage) {
  const base = (typeof currentLatex === 'string' && currentLatex.trim()) || BASELINE_LATEX_OUTLINE;
  const insertion = `% User requested: ${userMessage || 'No additional details provided.'}`;

  if (base.includes('\\end{document}')) {
    return base.replace('\\end{document}', `${insertion}\n\\end{document}`);
  }

  return `${base}\n${insertion}`;
}

async function draftLatexNode(state) {
  const claude = getClaudeClient();
  const userMessage = typeof state.userMessage === 'string' ? state.userMessage.trim() : '';
  const conversationHistory = Array.isArray(state.conversationHistory)
    ? state.conversationHistory.slice(-CONTEXT_TURNS_LIMIT)
    : [];
  const session = state.session;

  if (!session) {
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
    console.warn('[chatOrchestrator] No API key - using fallback');
    return {
      latexSource: buildFallbackLatex(currentLatex, userMessage),
      timestamp: new Date().toISOString(),
      feedback: 'Using fallback mode. Preserved your existing resume structure and noted your latest request.',
      shouldPersistLatex: true
    };
  }

  try {
    console.log('[chatOrchestrator] Calling Claude API - Model:', CLAUDE_MODEL, 'Tokens:', CLAUDE_MAX_TOKENS);

    const systemPrompt = [
      'You are a professional resume writer and LaTeX expert.',
      'Your task is to incrementally build a resume by preserving existing content and adding new information.',
      '',
      'ABSOLUTELY CRITICAL - YOU MUST FOLLOW THESE RULES:',
      '1. PRESERVE the entire current resume document structure - DO NOT DELETE any existing content unless user explicitly asks for reset/rewrite.',
      '2. When user adds information, find the appropriate section and ADD to it (do not replace the whole document).',
      '3. Keep LaTeX structural anchors intact: \\documentclass, \\begin{document}, \\end{document}.',
      '4. If current resume is incomplete/corrupt, use the baseline outline as structure and merge user-provided details.',
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

    const fullResponse = extractTextFromClaudeResponse(response);
    console.log('[chatOrchestrator] Raw Claude response (first 300 chars):', fullResponse.substring(0, 300));

    const normalizedResponse = normalizeJsonPayload(fullResponse);
    const parsed = JSON.parse(normalizedResponse);
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : 'Resume updated';
    const latexSource = typeof parsed.latex === 'string' ? parsed.latex.trim() : '';
    console.log('[chatOrchestrator] JSON parsed successfully. Feedback:', feedback.substring(0, 100));

    return {
      latexSource,
      feedback,
      timestamp: new Date().toISOString(),
      shouldPersistLatex: true
    };
  } catch (error) {
    console.error('[chatOrchestrator] ERROR:', error instanceof Error ? error.message : String(error), 'Full:', error);
    return {
      latexSource: currentLatex || BASELINE_LATEX_OUTLINE,
      feedback: `Could not safely apply this update. Kept your previous resume unchanged. (${error instanceof Error ? error.message : String(error)})`,
      validationError: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      shouldPersistLatex: false
    };
  }
}

async function validateLatexNode(state) {
  if (state.shouldPersistLatex === false) {
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
    return {
      validationError: 'No LaTeX source generated',
      latexSource: previousLatex || BASELINE_LATEX_OUTLINE,
      feedback: state.feedback || 'No valid update generated. Kept previous resume unchanged.',
      shouldPersistLatex: false
    };
  }

  const validation = validateLatexSyntax(latexSource);
  if (!validation.valid) {
    return {
      validationError: validation.errors?.join('; ') || 'LaTeX syntax error',
      latexSource: previousLatex || BASELINE_LATEX_OUTLINE,
      feedback: 'Generated LaTeX failed validation, so your previous resume was preserved.',
      shouldPersistLatex: false
    };
  }

  if (previousLatex && !resetIntent) {
    const shrinkRatio = previousLatex.length > 0 ? latexSource.length / previousLatex.length : 1;
    if (shrinkRatio < 0.7) {
      return {
        validationError: `Candidate LaTeX shrank unexpectedly (ratio: ${shrinkRatio.toFixed(2)}).`,
        latexSource: previousLatex,
        feedback: 'I preserved your previous resume because the generated update looked incomplete.',
        shouldPersistLatex: false
      };
    }
  }

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

export async function buildAssistantTurn({ session, userMessage = '' }) {
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
    shouldPersistLatex: true
  });

  const now = finalState.timestamp || new Date().toISOString();
  const hasError = Boolean(finalState.validationError);

  console.log('[buildAssistantTurn] Final state - feedback:', finalState.feedback?.substring(0, 80), 'latexLength:', finalState.latexSource?.length, 'persist:', Boolean(finalState.shouldPersistLatex));

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

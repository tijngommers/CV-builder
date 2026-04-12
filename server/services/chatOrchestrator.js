import Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { validateLatexSyntax } from './latexValidator.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest';
const CLAUDE_MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 800);

const OrchestrationState = Annotation.Root({
  session: Annotation(),
  userMessage: Annotation(),
  conversationHistory: Annotation(),
  latexSource: Annotation(),
  validationError: Annotation(),
  timestamp: Annotation()
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

async function draftLatexNode(state) {
  const claude = getClaudeClient();
  const userMessage = typeof state.userMessage === 'string' ? state.userMessage.trim() : '';
  const conversationHistory = Array.isArray(state.conversationHistory) ? state.conversationHistory : [];

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
    return {
      latexSource: `\\documentclass{article}
\\usepackage[empty]{fullpage}
\\pagestyle{empty}
\\begin{document}
\\section*{Resume Draft}
${userMessage || 'Resume content placeholder.'}
\\end{document}`,
      timestamp: new Date().toISOString()
    };
  }

  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      temperature: 0.3,
      system: [
        'You are a professional resume writer and LaTeX expert.',
        'Return only complete compilable LaTeX source.',
        'No markdown. No explanations. Only LaTeX.'
      ].join(' '),
      messages
    });

    return {
      latexSource: extractTextFromClaudeResponse(response),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      latexSource: `\\documentclass{article}
\\usepackage[empty]{fullpage}
\\pagestyle{empty}
\\begin{document}
\\section*{Error}
Failed to generate LaTeX: ${error.message}
\\end{document}`,
      timestamp: new Date().toISOString()
    };
  }
}

async function validateLatexNode(state) {
  const latexSource = typeof state.latexSource === 'string' ? state.latexSource : '';

  if (!latexSource) {
    return {
      validationError: 'No LaTeX source generated',
      latexSource: ''
    };
  }

  const validation = validateLatexSyntax(latexSource);
  if (!validation.valid) {
    return {
      validationError: validation.errors?.join('; ') || 'LaTeX syntax error',
      latexSource: ''
    };
  }

  return {
    validationError: null,
    latexSource
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
    validationError: null
  });

  const now = finalState.timestamp || new Date().toISOString();
  const hasError = Boolean(finalState.validationError);

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
        text: `Error generating resume: ${finalState.validationError}`,
        timestamp: now,
        isError: true
      }
    });
  } else {
    events.push({
      type: 'assistant_message',
      payload: {
        text: 'Resume updated. The live preview has been refreshed.',
        latexSource: finalState.latexSource,
        timestamp: now,
        isError: false
      }
    });
  }

  return {
    latexSource: finalState.latexSource,
    validationError: finalState.validationError,
    events
  };
}

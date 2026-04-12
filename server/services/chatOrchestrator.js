import Anthropic from '@anthropic-ai/sdk';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { validateLatexSyntax } from './latexValidator.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-1-20250805';
const CLAUDE_MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 2000);

const OrchestrationState = Annotation.Root({
  session: Annotation(),
  userMessage: Annotation(),
  conversationHistory: Annotation(),
  latexSource: Annotation(),
  feedback: Annotation(),
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
  const currentLatex = typeof state.session?.latexSource === 'string' ? state.session.latexSource : '';

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
      latexSource: `\\documentclass{article}
\\usepackage[empty]{fullpage}
\\pagestyle{empty}
\\begin{document}
\\section*{Resume Draft}
${userMessage || 'Resume content placeholder.'}
\\end{document}`,
      timestamp: new Date().toISOString(),
      feedback: 'Using fallback (no API key set)'
    };
  }

  try {
    console.log('[chatOrchestrator] Calling Claude API - Model:', CLAUDE_MODEL, 'Tokens:', CLAUDE_MAX_TOKENS);
    
    const systemPrompt = [
      'You are a professional resume writer and LaTeX expert.',
      'Your task is to incrementally build a resume by preserving existing content and adding new information.',
      '',
      'ABSOLUTELY CRITICAL - YOU MUST FOLLOW THESE RULES:',
      '1. PRESERVE the entire current resume document structure - DO NOT DELETE any existing content',
      '2. When user adds information, find the appropriate section and ADD to it (do not replace)',
      '3. Always return a COMPLETE LaTeX document with \\\\documentclass, \\\\begin{document}, and \\\\end{document}',
      '4. Return output ONLY as valid JSON (nothing else before or after)',
      '5. JSON format: {\"feedback\": \"what you added (1-2 sentences)\", \"latex\": \"<complete LaTeX code>\"}',
      '6. IMPORTANT: Include ALL existing sections from the current resume, with new content added to relevant sections',
      '',
      'CURRENT RESUME (preserve and build upon this):',
      '```',
      currentLatex || '[Empty - will be created from user input]',
      '```',
      '',
      'GOOD EXAMPLE:',
      '{\"feedback\": \"Added name Tijn Gommers to contact section. Next, add education or work experience.\", \"latex\": \"\\\\documentclass{article}\\\\usepackage[empty]{fullpage}\\\\begin{document}\\\\section*{CONTACT}\\\\textbf{Tijn Gommers}\\\\section*{EXPERIENCE}\\\\textit{[TODO: Add work experience]}\\\\end{document}\"}',
      '',
      'BAD EXAMPLES (DO NOT DO THIS):',
      '- Return plain text instead of JSON',
      '- Return LaTeX outside the JSON value',
      '- Delete existing content when adding new sections',
      '- Forget the {\"feedback\": \"...\", \"latex\": \"...\"} wrapper'
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
    
    // Try to parse as JSON first
    let feedback = 'Resume updated';
    let latexSource = '';
    
    try {
      const parsed = JSON.parse(fullResponse);
      feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : 'Resume updated';
      latexSource = typeof parsed.latex === 'string' ? parsed.latex.trim() : '';
      console.log('[chatOrchestrator] ✓ JSON parsed successfully. Feedback:', feedback.substring(0, 100));
    } catch (parseError) {
      // Fallback: try text delimiter format
      const parts = fullResponse.split('===LATEX===');
      if (parts.length > 1) {
        feedback = parts[0]?.trim() || 'Resume updated';
        latexSource = parts[1]?.trim() || '';
        console.log('[chatOrchestrator] ✓ Parsed as text delimiter format. Feedback:', feedback.substring(0, 100));
      } else {
        // Final fallback: first 150 chars as feedback, rest as LaTeX
        const firstNewline = fullResponse.indexOf('\n');
        if (firstNewline > 0) {
          feedback = fullResponse.substring(0, Math.min(150, firstNewline)).trim();
          latexSource = fullResponse.substring(firstNewline).trim();
        } else {
          latexSource = fullResponse;
        }
        console.log('[chatOrchestrator] ⚠ Using fallback parsing. Feedback:', feedback.substring(0, 100));
      }
    }
    
    console.log('[chatOrchestrator] API success. Feedback length:', feedback.length, 'LaTeX length:', latexSource.length);

    return {
      latexSource: latexSource,
      feedback: feedback,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[chatOrchestrator] ERROR:', error instanceof Error ? error.message : String(error), 'Full:', error);
    return {
      latexSource: `\\documentclass{article}
\\usepackage[empty]{fullpage}
\\pagestyle{empty}
\\begin{document}
\\section*{Error}
Failed to generate LaTeX: ${error instanceof Error ? error.message : String(error)}
\\end{document}`,
      feedback: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
      latexSource: '',
      feedback: state.feedback || ''
    };
  }

  return {
    validationError: null,
    latexSource,
    feedback: state.feedback || ''
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
  
  console.log('[buildAssistantTurn] Final state - feedback:', finalState.feedback?.substring(0, 80), 'latexLength:', finalState.latexSource?.length);

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
    events
  };
}

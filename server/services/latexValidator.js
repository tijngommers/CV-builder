/**
 * LaTeX Syntax Validator
 * Performs basic checks before compilation to catch errors early
 */

export function validateLatexSyntax(latexSource = '') {
  const errors = [];
  const warnings = [];

  if (!latexSource || typeof latexSource !== 'string') {
    return { valid: false, errors: ['LaTeX source must be a non-empty string'] };
  }

  const trimmed = latexSource.trim();

  // Check for required document structure
  if (!trimmed.includes('\\documentclass')) {
    errors.push('Missing \\documentclass declaration');
  }

  if (!trimmed.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }

  if (!trimmed.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }

  // Check for resume structure preservation
  const structureWarnings = validateResumeStructure(trimmed);
  warnings.push(...structureWarnings);

  // Check bracket/brace nesting
  const bracketErrors = validateBracketBalance(trimmed);
  errors.push(...bracketErrors);

  // Check common environment pairing
  const environmentErrors = validateEnvironmentPairing(trimmed);
  errors.push(...environmentErrors);

  // Check for balanced list markers and empty blocks
  const listErrors = validateListStructure(trimmed);
  errors.push(...listErrors);

  const result = {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
    // Log warnings to console for debugging
    warnings.forEach((w) => console.warn(`[LaTeX Validator] ${w}`));
  }

  return result;
}

function validateBracketBalance(latexSource) {
  const errors = [];
  const stack = [];
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const opens = Object.keys(pairs);

  for (let i = 0; i < latexSource.length; i++) {
    const char = latexSource[i];

    // Skip escaped characters
    if (i > 0 && latexSource[i - 1] === '\\') {
      continue;
    }

    if (opens.includes(char)) {
      stack.push({ char, index: i });
    } else if (Object.values(pairs).includes(char)) {
      if (stack.length === 0) {
        errors.push(`Unexpected closing bracket '${char}' at position ${i}`);
        continue;
      }

      const last = stack[stack.length - 1];
      if (pairs[last.char] === char) {
        stack.pop();
      } else {
        errors.push(`Mismatched bracket: expected '${pairs[last.char]}' but found '${char}' at position ${i}`);
      }
    }
  }

  if (stack.length > 0) {
    stack.forEach((item) => {
      errors.push(`Unclosed bracket '${item.char}' at position ${item.index}`);
    });
  }

  return errors;
}

function validateEnvironmentPairing(latexSource) {
  const errors = [];
  const environmentRegex = /\\begin\{(\w+)\}|\\end\{(\w+)\}/g;
  const stack = [];
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = environmentRegex.exec(latexSource)) !== null) {
    const envName = match[1] || match[2];
    const isBegin = Boolean(match[1]);

    if (isBegin) {
      stack.push(envName);
    } else {
      if (stack.length === 0) {
        errors.push(`Unexpected \\end{${envName}} without matching \\begin{${envName}}`);
        continue;
      }

      const lastEnv = stack[stack.length - 1];
      if (lastEnv === envName) {
        stack.pop();
      } else {
        errors.push(`Mismatched environment: expected \\end{${lastEnv}} but found \\end{${envName}}`);
      }
    }
  }

  if (stack.length > 0) {
    stack.forEach((envName) => {
      errors.push(`Unclosed \\begin{${envName}}`);
    });
  }

  return errors;
}

function validateResumeStructure(latexSource) {
  const warnings = [];
  const sectionKeywords = ['CONTACT', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'SUMMARY'];

  // Check if at least some resume sections are present
  const hasSections = sectionKeywords.some((section) => latexSource.includes(section));

  if (!hasSections) {
    warnings.push('Resume appears to lack standard sections (CONTACT, EXPERIENCE, EDUCATION, SKILLS). Structure may be incomplete.');
  }

  // Check for emptiness in document body
  const documentBodyMatch = latexSource.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (documentBodyMatch) {
    const bodyContent = documentBodyMatch[1].trim();
    if (bodyContent.length < 50) {
      warnings.push('Resume content is very minimal. Consider adding more details about experience and education.');
    }
  }

  return warnings;
}

function validateListStructure(latexSource) {
  const errors = [];

  // Check for balanced \resumeSubHeadingListStart/End pairs
  const subHeadingStartCount = (latexSource.match(/\\resumeSubHeadingListStart/g) || []).length;
  const subHeadingEndCount = (latexSource.match(/\\resumeSubHeadingListEnd/g) || []).length;
  if (subHeadingStartCount !== subHeadingEndCount) {
    errors.push(`Mismatched \\resumeSubHeadingListStart (${subHeadingStartCount}) and \\resumeSubHeadingListEnd (${subHeadingEndCount}) markers`);
  }

  // Check for balanced \resumeItemListStart/End pairs
  const itemStartCount = (latexSource.match(/\\resumeItemListStart/g) || []).length;
  const itemEndCount = (latexSource.match(/\\resumeItemListEnd/g) || []).length;
  if (itemStartCount !== itemEndCount) {
    errors.push(`Mismatched \\resumeItemListStart (${itemStartCount}) and \\resumeItemListEnd (${itemEndCount}) markers`);
  }

  // Check for empty list blocks: \resumeSubHeadingListStart immediately followed by \resumeSubHeadingListEnd
  const emptySubHeadingPattern = /\\resumeSubHeadingListStart\s*\\resumeSubHeadingListEnd/g;
  if (emptySubHeadingPattern.test(latexSource)) {
    errors.push('Found empty \\resumeSubHeadingListStart...\\resumeSubHeadingListEnd block with no items');
  }

  // Check for empty \begin{itemize}...\end{itemize} blocks (no \item inside)
  const itemizePattern = /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g;
  let itemizeMatch;
  // eslint-disable-next-line no-cond-assign
  while ((itemizeMatch = itemizePattern.exec(latexSource)) !== null) {
    const content = itemizeMatch[1];
    if (!content.includes('\\item')) {
      const lineNum = latexSource.substring(0, itemizeMatch.index).split('\n').length;
      errors.push(`Empty \\begin{itemize}...\\end{itemize} block at line ${lineNum} (no \\item inside)`);
    }
  }

  return errors;
}

/**
 * LaTeX Syntax Validator
 * Performs basic checks before compilation to catch errors early
 */

export function validateLatexSyntax(latexSource = '') {
  const errors = [];

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

  // Check bracket/brace nesting
  const bracketErrors = validateBracketBalance(trimmed);
  errors.push(...bracketErrors);

  // Check common environment pairing
  const environmentErrors = validateEnvironmentPairing(trimmed);
  errors.push(...environmentErrors);

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
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

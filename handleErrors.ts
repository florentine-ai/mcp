import {ZodError} from 'zod';
import {TErrorResponse} from './types';

const handleZodError = (error: ZodError): TErrorResponse => {
  const issue = error.issues[0];

  // Determine a specific error code
  let errorCode = 'INVALID_INPUT';
  let message = '';
  if (issue.path.includes('llmKey') && issue.message.includes('"llmService"')) {
    errorCode = 'LLM_KEY_WITHOUT_SERVICE';
    message = issue.message;
  } else if (
    issue.path.includes('llmService') &&
    issue.message.includes('"llmKey"')
  ) {
    errorCode = 'LLM_SERVICE_WITHOUT_KEY';
    message = issue.message;
  } else if (
    issue.path.includes('florentineToken') &&
    issue.code === 'invalid_type' &&
    (issue as any).received === 'undefined'
  ) {
    errorCode = 'NO_TOKEN';
    message =
      'Please provide your Florentine API key. You can find it in your account settings: https://florentine.ai/settings';
  } else {
    const field = issue.path.join('.');
    switch (issue.code) {
      case 'invalid_type':
        if ((issue as any).received === 'undefined') {
          message = `"${field}" is required, but missing.`;
        } else {
          message = `"${field}" must be a ${(issue as any).expected}.`;
        }
        break;

      case 'invalid_value':
        message = `The value for "${field}" is not valid.`;
        break;

      case 'too_small':
        message = `"${field}" is too short.`;
        break;

      case 'too_big':
        message = `"${field}" is too long.`;
        break;

      case 'custom':
        message = `Problem with "${field}": ${issue.message}`;
        break;

      default:
        message = `There is a problem with "${field}": ${issue.message}`;
        break;
    }
  }
  return {
    error: {
      name: 'FlorentineApiError',
      message,
      errorCode,
      statusCode: 400,
      requestId: 'local'
    }
  };
};

const unknownError = {
  error: {
    name: 'FlorentineUnknownError',
    message: 'An unknown error occurred.',
    errorCode: 'UNKNOWN_ERROR',
    statusCode: 500,
    requestId: 'local'
  }
} as TErrorResponse;

export {handleZodError, unknownError};

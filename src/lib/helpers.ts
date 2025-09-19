import {
  TAskInput,
  TFlorentineConfig,
  TFlorentineRequestConfig
} from './types.js';

const mergeConfigs = ({
  florentineConfig,
  inputConfig
}: {
  florentineConfig: TFlorentineConfig;
  inputConfig: TAskInput;
}): TFlorentineRequestConfig => {
  return {
    ...(florentineConfig.llmService
      ? { llmService: florentineConfig.llmService }
      : {}),
    ...(florentineConfig.llmKey ? { llmKey: florentineConfig.llmKey } : {}),
    ...(inputConfig.sessionId
      ? { sessionId: inputConfig.sessionId }
      : florentineConfig.sessionId
      ? { sessionId: florentineConfig.sessionId }
      : {}),
    ...(florentineConfig.returnTypes.length || inputConfig.returnTypes
      ? {
          returnTypes: Object.assign(
            florentineConfig.returnTypes,
            inputConfig.returnTypes
          )
        }
      : { returnTypes: ['result'] }),
    ...(florentineConfig.requiredInputs?.length || inputConfig.requiredInputs
      ? {
          requiredInputs: Object.assign(
            florentineConfig.requiredInputs || [],
            inputConfig.requiredInputs
          )
        }
      : {})
  };
};
export { mergeConfigs };

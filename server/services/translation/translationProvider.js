import { translateWithOpenAI } from './providers/openAiTranslationProvider.js';

export function getActiveTranslationProvider() {
  return {
    name: 'openai',
    translate: translateWithOpenAI,
  };
}

export async function translateEntityFields(request) {
  const provider = getActiveTranslationProvider();

  return provider.translate(request);
}

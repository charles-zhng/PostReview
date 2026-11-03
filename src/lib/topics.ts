// "AI" is matched case-sensitively to avoid words like "said".
const AI_UPPER = /\b(AI|AGI|LLMs?|GPT[-\w.]*|RL|ML)\b/;
const AI_TERMS =
  /\b(openai|anthropic|deepmind|claude|gemini|qwen|llama|mistral|kimi|deepseek|codex|copilot|cursor|chatgpt)\w*|\b(neural|transformers?|weights|agents?|agentic|machine learning|deep learning|diffusion|reasoning model|language models?|frontier models?|world model|fine-?tun\w*|inference|benchmarks?|tokens?|embeddings?|alignment|interpretability|superintelligence|scaling|compute)\b/i;

export function isAiRelated(text: string): boolean {
  return AI_UPPER.test(text) || AI_TERMS.test(text);
}

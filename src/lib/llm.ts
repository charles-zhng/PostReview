import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type Role = "reviewer" | "areaChair";

const DEFAULTS: Record<string, Record<Role, string>> = {
  anthropic: { reviewer: "claude-sonnet-5-5", areaChair: "claude-opus-5-5" },
  openai: { reviewer: "gpt-5", areaChair: "gpt-5" },
};

export function modelId(role: Role): string {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  const override =
    role === "reviewer" ? process.env.REVIEWER_MODEL : process.env.AC_MODEL;
  const id = override ?? DEFAULTS[provider]?.[role];
  if (!id)
    throw new Error(
      `No model configured for provider "${provider}" role "${role}"`,
    );
  return `${provider}:${id}`;
}

export function getModel(role: Role): LanguageModel {
  const full = modelId(role);
  const provider = full.slice(0, full.indexOf(":"));
  const id = full.slice(full.indexOf(":") + 1);
  switch (provider) {
    case "anthropic":
      return anthropic(id);
    case "openai":
      return openai(id);
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${provider}" (use anthropic or openai)`,
      );
  }
}

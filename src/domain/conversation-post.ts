import type { WineContext } from "./wine-context";

export type PostSource = "linkedin" | "vivino" | "test";

export interface ConversationPost {
  text: string;
  source?: PostSource;
  author?: string;
  wine?: WineContext;
}

export function postText(post: ConversationPost): string {
  return post.text.trim();
}

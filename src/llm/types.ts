// Content can be a string or an array of content parts (for vision)
export type MessageContent = string | ContentPart[];

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image_url";
  image_url: {
    url: string; // Can be a URL or base64 data URI
  };
}

export interface VideoContentPart {
  type: "video_url";
  video_url: {
    url: string; // Can be a URL or base64 data URI (data:video/mp4;base64,...)
  };
}

export type ContentPart = TextContentPart | ImageContentPart | VideoContentPart;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  include_reasoning?: boolean;
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

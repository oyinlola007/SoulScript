export interface ChatSession {
  id: string;
  title: string;
  is_active: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_blocked?: boolean;
  blocked_reason?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  session_id: string;
  created_at: string;
}

export interface ChatSessionCreate {
  title: string;
}

export interface ChatSessionUpdate {
  title?: string;
}

export interface ChatMessageCreate {
  content: string;
  session_id: string;
}

export interface ChatSessionsResponse {
  data: ChatSession[];
  count: number;
}

export interface ChatMessagesResponse {
  data: ChatMessage[];
  count: number;
} 
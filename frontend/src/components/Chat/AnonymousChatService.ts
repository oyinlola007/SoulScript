import { request } from "@/client/core/request";
import { OpenAPI } from "@/client/core/OpenAPI";

export class AnonymousChatService {
  static async createOrFetchSession(anon_session_id: string) {
    return await request(OpenAPI, {
      method: "POST",
      url: "/api/v1/chat/anon/session",
      body: { anon_session_id },
      mediaType: "application/json",
    });
  }

  static async getMessages(anon_session_id: string) {
    return await request(OpenAPI, {
      method: "GET",
      url: "/api/v1/chat/anon/session/messages",
      query: { anon_session_id },
    });
  }

  static async sendMessage(anon_session_id: string, content: string) {
    return await request(OpenAPI, {
      method: "POST",
      url: "/api/v1/chat/anon/session/message",
      body: { anon_session_id, content },
      mediaType: "application/json",
    });
  }

  static async updateSessionTitle(sessionId: string, title: string, isAnon = true) {
    return await request(OpenAPI, {
      method: "PUT",
      url: isAnon ? `/api/v1/chat/anon/session/${sessionId}` : `/api/v1/chat/sessions/${sessionId}`,
      body: { title },
      mediaType: "application/json",
    });
  }

  static async streamMessage(sessionId: string, content: string) {
    // For streaming, use fetch directly
    const response = await fetch(`${OpenAPI.BASE}/api/v1/chat/anon/session/${sessionId}/stream`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, role: 'user' }),
    });
    if (!response.ok) {
      throw new Error('Failed to stream AI response');
    }
    return response;
  }
} 
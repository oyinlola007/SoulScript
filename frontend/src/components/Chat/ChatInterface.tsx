import React, { useState, useEffect } from 'react';
import { Box, Flex, VStack, HStack, Text, Button, Input, useToast } from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import { ChatSession, ChatMessage } from '../../types/chat';
import ChatSessionList from './ChatSessionList';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import useAuth from '../../hooks/useAuth';
import useCustomToast from '../../hooks/useCustomToast';
import { BLOCKED_CONTENT_MESSAGE, BLOCKED_SESSION_DELETE_ERROR, CHAT_SELECT_MESSAGE, START_NEW_CHAT_BUTTON } from '../../constants/prompts';
import { OpenAPI } from '@/client/core/OpenAPI';
import { request } from '@/client/core/request';

interface ChatInterfaceProps {}

// Chat Service
class ChatService {
  static async getSessions(): Promise<{ data: ChatSession[] }> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "GET",
        url: `/api/v1/chat/sessions`,
      });

      return response as { data: ChatSession[] };
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }

  static async getMessages(sessionId: string): Promise<{ data: ChatMessage[] }> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "GET",
        url: `/api/v1/chat/sessions/${sessionId}/messages`,
      });

      return response as { data: ChatMessage[] };
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }

  static async getSession(sessionId: string): Promise<ChatSession> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "GET",
        url: `/api/v1/chat/sessions/${sessionId}`,
      });

      return response as ChatSession;
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }

  static async createSession(title: string): Promise<ChatSession> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "POST",
        url: `/api/v1/chat/sessions`,
        body: { title },
        mediaType: "application/json",
      });

      return response as ChatSession;
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }

  static async streamMessage(sessionId: string, content: string, role: string): Promise<Response> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // For streaming, we need to use fetch directly since the request function is for JSON
    const response = await fetch(`${OpenAPI.BASE}/api/v1/chat/sessions/${sessionId}/stream`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        role,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to stream AI response');
    }

    return response;
  }

  static async deleteSession(sessionId: string): Promise<any> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "DELETE",
        url: `/api/v1/chat/sessions/${sessionId}`,
      });

      return response;
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }

  static async updateSessionTitle(sessionId: string, title: string): Promise<ChatSession> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "PUT",
        url: `/api/v1/chat/sessions/${sessionId}`,
        body: { title },
        mediaType: "application/json",
      });

      return response as ChatSession;
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }
}

const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const { user } = useAuth();
  const { showErrorToast, showSuccessToast } = useCustomToast();

  // Fetch user's chat sessions
  const fetchSessions = async () => {
    try {
      const data = await ChatService.getSessions();
      setSessions(data.data);
    } catch (error) {
      showErrorToast('Failed to load chat sessions');
    }
  };

  // Fetch messages for a session
  const fetchMessages = async (sessionId: string) => {
    try {
      const data = await ChatService.getMessages(sessionId);
      setMessages(data.data);
    } catch (error) {
      showErrorToast('Failed to load messages');
    }
  };

  // Create a new chat session
  const createNewSession = async () => {
    try {
      const newSession = await ChatService.createSession('New Chat');
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      setMessages([]);
      setIsLoading(false);
      setIsBlocked(false);
      setBlockedReason('');
    } catch (error) {
      showErrorToast('Failed to create new session');
    }
  };

  // Send a message
  const sendMessage = async (content: string) => {
    if (!currentSession) {
      showErrorToast('No active session');
      return;
    }

    // Create temporary user message to show immediately
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSession.id,
      role: 'user',
      content: content,
      created_at: new Date().toISOString()
    };

    // Add user message immediately
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);

    // Create a temporary AI message for streaming
    const tempAIMessage: ChatMessage = {
      id: `ai-temp-${Date.now()}`,
      session_id: currentSession.id,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempAIMessage]);

    let firstTokenReceived = false;
    try {
      // If this is the first message and session title is default, update session title
      if (currentSession.title === 'New Chat' && messages.length === 0) {
        const truncatedTitle = content.length > 40 ? content.slice(0, 40) + '…' : content;
        await updateSessionTitle(currentSession.id, truncatedTitle);
      }

      const response = await ChatService.streamMessage(currentSession.id, content, "user");

      if (!response.body) {
        throw new Error('Failed to stream AI response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let aiContent = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          aiContent += chunk;
          setMessages(prev => prev.map(msg =>
            msg.id === tempAIMessage.id ? { ...msg, content: aiContent } : msg
          ));
          // As soon as the first token is received, stop showing AI is thinking
          if (!firstTokenReceived && chunk.trim() !== '') {
            setIsLoading(false);
            firstTokenReceived = true;
          }
        }
      }

      // Finalize the AI message (replace temp IDs if needed)
      setMessages(prev => {
        // Remove the temp user message (if not already replaced)
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        // The AI message is already updated in place
        return filtered;
      });

      // Fetch the latest messages to ensure the real user message is shown
      await fetchMessages(currentSession.id);

      // Fetch the latest session data to check for blocked status
      try {
        const updatedSession = await ChatService.getSession(currentSession.id);
        setCurrentSession(updatedSession);
        setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
        if (updatedSession.is_blocked) {
          setIsBlocked(true);
          setBlockedReason(updatedSession.blocked_reason || 'Content violation');
        } else {
          setIsBlocked(false);
          setBlockedReason('');
        }
      } catch (e) {
        // Ignore session fetch errors
      }

    } catch (error) {
      // Remove the temporary messages if request failed
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id && msg.id !== tempAIMessage.id));
      showErrorToast('Failed to send message');
      setIsLoading(false);
    } finally {
      // If no token was received, ensure loading is stopped
      setIsLoading(false);
    }
  };

  // Select a session
  const selectSession = (session: ChatSession) => {
    setCurrentSession(session);
    setIsLoading(false);
    
    // Check if session is blocked
    if (session.is_blocked) {
      setIsBlocked(true);
      setBlockedReason(session.blocked_reason || 'Content violation');
    } else {
      setIsBlocked(false);
      setBlockedReason('');
    }
    
    fetchMessages(session.id);
  };

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      await ChatService.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      showSuccessToast('Session deleted successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot delete a blocked session')) {
        showErrorToast(BLOCKED_SESSION_DELETE_ERROR);
      } else {
        showErrorToast('Failed to delete session');
      }
    }
  };

  // Update session title
  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      const updatedSession = await ChatService.updateSessionTitle(sessionId, title);
      setSessions(prev => 
        prev.map(s => s.id === sessionId ? updatedSession : s)
      );
      if (currentSession?.id === sessionId) {
        setCurrentSession(updatedSession);
      }
    } catch (error) {
      showErrorToast('Failed to update session title');
    }
  };

  // Load sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <Flex h="calc(100vh - 100px)" bg={useColorModeValue('gray.50', 'gray.900')}>
      {/* Left Sidebar - 30% width */}
      <Box w="30%" bg={useColorModeValue('white', 'gray.800')} borderRight="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
        <ChatSessionList
          sessions={sessions}
          currentSession={currentSession}
          onSelectSession={selectSession}
          onCreateSession={createNewSession}
          onDeleteSession={deleteSession}
          onUpdateTitle={updateSessionTitle}
        />
      </Box>

      {/* Main Chat Area - 70% width */}
      <Box w="70%" p={1}>
        <Box 
          h="full" 
          bg={useColorModeValue('white', 'gray.800')} 
          border="0.5px" 
          borderColor={useColorModeValue('gray.200', 'gray.700')} 
          borderRadius="lg"
          overflow="hidden"
        >
          {currentSession ? (
            <VStack h="full" spacing={0}>
              {/* Blocked Status Banner */}
              {isBlocked && (
                <Box w="full" bg={useColorModeValue('red.50', 'red.900')} borderBottom="1px" borderColor={useColorModeValue('red.200', 'red.700')} p={3}>
                  <Text fontSize="sm" color={useColorModeValue('red.700', 'red.200')} textAlign="center" fontWeight="medium">
                    ⚠️ This chat session has been blocked for your safety
                  </Text>
                </Box>
              )}
              
              {/* Messages Area */}
              <Box flex={1} w="full" overflowY="auto">
                <ChatMessages messages={messages} isLoading={isLoading} />
              </Box>

              {/* Input Area */}
              <Box w="full" p={4} borderTop="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                <ChatInput onSendMessage={sendMessage} isLoading={isLoading} isBlocked={isBlocked} />
              </Box>
            </VStack>
          ) : (
            <Flex h="full" align="center" justify="center">
              <VStack spacing={4}>
                <Text fontSize="xl" color={useColorModeValue('gray.500', 'gray.400')}>
                  {CHAT_SELECT_MESSAGE}
                </Text>
                <Button colorScheme="blue" onClick={createNewSession}>
                  {START_NEW_CHAT_BUTTON}
                </Button>
              </VStack>
            </Flex>
          )}
        </Box>
      </Box>
    </Flex>
  );
};

export default ChatInterface; 
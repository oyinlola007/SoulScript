import React, { useState, useEffect } from 'react';
import { Box, Flex, VStack, HStack, Text, Button, Input, useToast } from '@chakra-ui/react';
import { ChatSession, ChatMessage } from '../../types/chat';
import ChatSessionList from './ChatSessionList';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import useAuth from '../../hooks/useAuth';
import useCustomToast from '../../hooks/useCustomToast';

interface ChatInterfaceProps {}

const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { showErrorToast, showSuccessToast } = useCustomToast();

  // Fetch user's chat sessions
  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        showErrorToast('No authentication token found');
        return;
      }

      const response = await fetch('http://api.localhost/api/v1/chat/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data);
      } else {
        showErrorToast('Failed to load chat sessions');
      }
    } catch (error) {
      showErrorToast('Failed to load chat sessions');
    }
  };

  // Fetch messages for a session
  const fetchMessages = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        showErrorToast('No authentication token found');
        return;
      }

      const response = await fetch(`http://api.localhost/api/v1/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data);
      } else {
        showErrorToast('Failed to load messages');
      }
    } catch (error) {
      showErrorToast('Failed to load messages');
    }
  };

  // Create a new chat session
  const createNewSession = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        showErrorToast('No authentication token found');
        return;
      }

      const response = await fetch('http://api.localhost/api/v1/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'New Chat',
        }),
      });
      
      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [newSession, ...prev]);
        setCurrentSession(newSession);
        setMessages([]);
        setIsLoading(false);
      } else {
        showErrorToast('Failed to create new session');
      }
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
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        showErrorToast('No authentication token found');
        return;
      }

      const response = await fetch(`http://api.localhost/api/v1/chat/sessions/${currentSession.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          role: "user",
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Replace the temporary user message with the real one and add AI message
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
          return [...filtered, result.user_message, result.ai_message];
        });
        
        // Update session title if it was auto-generated
        if (result.session.title !== currentSession.title) {
          setCurrentSession(result.session);
          setSessions(prev => 
            prev.map(s => s.id === result.session.id ? result.session : s)
          );
        }
      } else {
        // Remove the temporary message if request failed
        setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
        showErrorToast('Failed to send message');
      }
    } catch (error) {
      // Remove the temporary message if request failed
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      showErrorToast('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a session
  const selectSession = (session: ChatSession) => {
    setCurrentSession(session);
    setIsLoading(false);
    fetchMessages(session.id);
  };

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        showErrorToast('No authentication token found');
        return;
      }

      const response = await fetch(`http://api.localhost/api/v1/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
          setMessages([]);
        }
        showSuccessToast('Session deleted successfully');
      } else {
        showErrorToast('Failed to delete session');
      }
    } catch (error) {
      showErrorToast('Failed to delete session');
    }
  };

  // Update session title
  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        showErrorToast('No authentication token found');
        return;
      }

      const response = await fetch(`http://api.localhost/api/v1/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
      });
      
      if (response.ok) {
        const updatedSession = await response.json();
        setSessions(prev => 
          prev.map(s => s.id === sessionId ? updatedSession : s)
        );
        if (currentSession?.id === sessionId) {
          setCurrentSession(updatedSession);
        }
      } else {
        showErrorToast('Failed to update session title');
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
    <Flex h="calc(100vh - 100px)" bg="gray.50">
      {/* Left Sidebar - 30% width */}
      <Box w="30%" bg="white" borderRight="1px" borderColor="gray.200">
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
          bg="white" 
          border="0.5px" 
          borderColor="gray.5000" 
          borderRadius="lg"
          overflow="hidden"
        >
          {currentSession ? (
            <VStack h="full" spacing={0}>
              {/* Messages Area */}
              <Box flex={1} w="full" overflowY="auto">
                <ChatMessages messages={messages} isLoading={isLoading} />
              </Box>

              {/* Input Area */}
              <Box w="full" p={4} borderTop="1px" borderColor="gray.200">
                <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
              </Box>
            </VStack>
          ) : (
            <Flex h="full" align="center" justify="center">
              <VStack spacing={4}>
                <Text fontSize="xl" color="gray.500">
                  Select a chat session or create a new one
                </Text>
                <Button colorScheme="blue" onClick={createNewSession}>
                  Start New Chat
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
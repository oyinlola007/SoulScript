import React, { useEffect, useRef } from 'react';
import { Box, VStack, HStack, Text, Avatar, Flex, Spinner } from '@chakra-ui/react';
import { ChatMessage } from '../../types/chat';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (messages.length === 0) {
    return (
      <Box p={8} textAlign="center">
        <Text color="gray.500" fontSize="lg">
          Start a conversation by sending a message
        </Text>
      </Box>
    );
  }

  return (
    <Box p={4} display="flex" flexDirection="column">
      {messages.map((message, index) => (
        <Box
          key={index}
          alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
          maxW="70%"
          mb={3}
        >
          <Box
            bg={message.role === 'user' ? 'blue.500' : 'gray.100'}
            color={message.role === 'user' ? 'white' : 'black'}
            px={4}
            py={3}
            borderRadius="lg"
            maxW="100%"
          >
            <Text
              fontSize="sm"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
            >
              {message.content}
            </Text>
          </Box>
        </Box>
      ))}
      
      {/* AI Loading Indicator */}
      {isLoading && (
        <Box
          alignSelf="flex-start"
          maxW="70%"
          mb={3}
        >
          <Box
            bg="gray.100"
            color="black"
            px={4}
            py={3}
            borderRadius="lg"
            maxW="100%"
          >
            <HStack spacing={2}>
              <Spinner size="sm" color="blue.500" />
              <Text fontSize="sm" color="gray.600">
                AI is thinking...
              </Text>
            </HStack>
          </Box>
        </Box>
      )}
    </Box>
  );

};

export default ChatMessages; 
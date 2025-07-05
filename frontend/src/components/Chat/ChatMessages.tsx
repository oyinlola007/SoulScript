import React, { useEffect, useRef } from 'react';
import { Box, VStack, HStack, Text, Avatar } from '@chakra-ui/react';
import { ChatMessage } from '../../types/chat';

interface ChatMessagesProps {
  messages: ChatMessage[];
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages }) => {
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
    <VStack spacing={4} p={4} align="stretch" h="full" overflowY="auto">
      {messages.map((message) => (
        <Box
          key={message.id}
          alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
          maxW="70%"
        >
          <HStack
            spacing={3}
            align="start"
            direction={message.role === 'user' ? 'row-reverse' : 'row'}
          >
            <Avatar
              size="sm"
              name={message.role === 'user' ? 'You' : 'AI'}
              src={message.role === 'user' ? undefined : undefined}
              bg={message.role === 'user' ? 'blue.500' : 'green.500'}
            />
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
              <Text
                fontSize="xs"
                color={message.role === 'user' ? 'blue.100' : 'gray.500'}
                mt={2}
                textAlign={message.role === 'user' ? 'right' : 'left'}
              >
                {formatTime(message.created_at)}
              </Text>
            </Box>
          </HStack>
        </Box>
      ))}
      <div ref={messagesEndRef} />
    </VStack>
  );
};

export default ChatMessages; 
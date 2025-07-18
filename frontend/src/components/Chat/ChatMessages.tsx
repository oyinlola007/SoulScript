import React, { useRef } from 'react';
import { Box, Text, Spinner, Flex } from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../../types/chat';
import { useColorModeValue } from '../ui/color-mode';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

function useChatScroll(dep: any) {
  const ref = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dep]);
  return ref;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isLoading }) => {
  const chatScrollRef = useChatScroll(messages[messages.length - 1]?.content);

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
    <Box p={4} display="flex" flexDirection="column" ref={chatScrollRef} style={{ overflowY: 'auto', height: '100%' }}>
      {messages.map((message, index) => (
        <Box
          key={index}
          alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
          maxW="70%"
          mb={3}
        >
          <Box
            bg={message.role === 'user' ? useColorModeValue('blue.500', 'blue.300') : useColorModeValue('gray.100', 'gray.700')}
            color={message.role === 'user' ? useColorModeValue('white', 'gray.900') : useColorModeValue('black', 'white')}
            px={4}
            py={3}
            borderRadius="lg"
            maxW="100%"
          >
            {message.role === 'user' ? (
              <Text
                fontSize="sm"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
              >
                {message.content}
              </Text>
            ) : (
              <Box fontSize="sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </Box>
            )}
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
            bg={useColorModeValue('gray.100', 'gray.700')}
            color={useColorModeValue('black', 'white')}
            px={4}
            py={3}
            borderRadius="lg"
            maxW="100%"
          >
            <Flex align="center">
              <Spinner size="sm" color={useColorModeValue('blue.500', 'blue.300')} style={{ marginRight: 8 }} />
              <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                AI is thinking...
              </Text>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ChatMessages; 
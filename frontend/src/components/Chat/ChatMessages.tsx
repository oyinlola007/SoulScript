import React, { useRef } from 'react';
import { Box, VStack, HStack, Text, Avatar, Flex, Spinner } from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../../types/chat';

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
    <Box p={4} display="flex" flexDirection="column" ref={chatScrollRef} style={{ overflowY: 'auto', height: '100%' }}>
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
            {message.role === 'user' ? (
              <Text
                fontSize="sm"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
              >
                {message.content}
              </Text>
            ) : (
              <Box
                fontSize="sm"
                sx={{
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    fontWeight: 'bold',
                    mb: 2,
                    mt: 3,
                  },
                  '& h1': { fontSize: 'lg' },
                  '& h2': { fontSize: 'md' },
                  '& h3, & h4, & h5, & h6': { fontSize: 'sm' },
                  '& p': { mb: 2 },
                  '& ul, & ol': { mb: 2, pl: 4 },
                  '& li': { mb: 1 },
                  '& code': {
                    bg: 'gray.200',
                    px: 1,
                    py: 0.5,
                    borderRadius: 'sm',
                    fontSize: 'xs',
                    fontFamily: 'mono',
                  },
                  '& pre': {
                    bg: 'gray.100',
                    p: 2,
                    borderRadius: 'md',
                    overflow: 'auto',
                    mb: 2,
                  },
                  '& pre code': {
                    bg: 'transparent',
                    p: 0,
                  },
                  '& blockquote': {
                    borderLeft: '3px solid',
                    borderColor: 'gray.300',
                    pl: 3,
                    ml: 0,
                    mb: 2,
                    fontStyle: 'italic',
                  },
                  '& strong': { fontWeight: 'bold' },
                  '& em': { fontStyle: 'italic' },
                  '& a': { color: 'blue.500', textDecoration: 'underline' },
                }}
              >
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
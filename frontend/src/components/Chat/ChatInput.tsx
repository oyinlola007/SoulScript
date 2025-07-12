import React, { useState, KeyboardEvent } from 'react';
import { HStack, Input, IconButton, Spinner } from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import { FiSend } from 'react-icons/fi';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isBlocked?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, isBlocked = false }) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !isLoading && !isBlocked) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isBlocked) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <HStack spacing={3}>
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={isBlocked ? "Chat session blocked" : "Type your message..."}
        disabled={isLoading || isBlocked}
        size="lg"
        borderRadius="full"
        borderColor={useColorModeValue('gray.300', 'gray.600')}
        _focus={{
          borderColor: useColorModeValue('blue.500', 'blue.300'),
          boxShadow: `0 0 0 1px ${useColorModeValue('var(--chakra-colors-blue-500)', 'var(--chakra-colors-blue-300)')}`,
        }}
      />
      <IconButton
        aria-label="Send message"
        onClick={handleSend}
        disabled={!message.trim() || isLoading || isBlocked}
        colorScheme="blue"
        size="lg"
        borderRadius="full"
      >
        {isLoading ? <Spinner size="sm" /> : <FiSend fontSize="18" />}
      </IconButton>
    </HStack>
  );
};

export default ChatInput; 
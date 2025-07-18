import React, { useState, useEffect, useRef } from "react";
import { Box, Flex, useBreakpointValue, Button, Text } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger
} from "../ui/dialog";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import type { ChatMessage } from "@/types/chat";
import { AnonymousChatService } from "./AnonymousChatService";
import { useColorModeValue } from "../ui/color-mode";

const DAILY_LIMIT = 5;

function getOrCreateAnonSessionId() {
  const match = document.cookie.match(/(?:^|; )anon_session_id=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  const newId = crypto.randomUUID();
  document.cookie = `anon_session_id=${encodeURIComponent(newId)}; path=/; max-age=31536000`;
  return newId;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getMessageCount() {
  const raw = localStorage.getItem("anon_message_count");
  if (!raw) return { date: getToday(), count: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date === getToday()) return parsed;
    return { date: getToday(), count: 0 };
  } catch {
    return { date: getToday(), count: 0 };
  }
}

function incrementMessageCount() {
  const { date, count } = getMessageCount();
  const newCount = date === getToday() ? count + 1 : 1;
  localStorage.setItem("anon_message_count", JSON.stringify({ date: getToday(), count: newCount }));
  return newCount;
}

const AnonymousChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageLimitReached, setMessageLimitReached] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const anonId = getOrCreateAnonSessionId();
    AnonymousChatService.createOrFetchSession(anonId)
      .then((res: any) => {
        setSessionId(res.id);
        return AnonymousChatService.getMessages(anonId);
      })
      .then((res: any) => {
        setMessages(res.data || []);
      })
      .catch(() => setMessages([]));
    // Check message limit on mount
    const { count } = getMessageCount();
    if (count >= DAILY_LIMIT) {
      setMessageLimitReached(true);
      setIsOpen(true);
    }
  }, []);

  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      return;
    }
    // Check daily limit
    const { count } = getMessageCount();
    if (count >= DAILY_LIMIT) {
      setMessageLimitReached(true);
      setIsOpen(true);
      return;
    }
    // Display user message immediately
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);
    const anonId = getOrCreateAnonSessionId();
    // Create a temporary AI message for streaming
    const tempAIMessage: ChatMessage = {
      id: `ai-temp-${Date.now()}`,
      session_id: sessionId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempAIMessage]);
    let firstTokenReceived = false;
    try {
      // Rename session if first message and title is default
      if (messages.length === 0) {
        const session = await AnonymousChatService.createOrFetchSession(anonId) as { id: string; title: string };
        if (session.title === 'New Chat') {
          const truncatedTitle = content.length > 40 ? content.slice(0, 40) + '…' : content;
          try {
            await AnonymousChatService.updateSessionTitle(sessionId, truncatedTitle, true);
          } catch {}
        }
      }
      // Stream AI response
      const response = await AnonymousChatService.streamMessage(sessionId, content);
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
      const msgRes: any = await AnonymousChatService.getMessages(anonId);
      setMessages(msgRes.data || []);
      // Increment message count
      const newCount = incrementMessageCount();
      if (newCount >= DAILY_LIMIT) {
        setMessageLimitReached(true);
        setIsOpen(true);
      }
    } catch (e) {
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id && msg.id !== tempAIMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Flex
        direction="column"
        h={isMobile ? "90%" : "100%"}
        w="100%"
        align={isMobile ? "stretch" : "center"}
        justify={isMobile ? "stretch" : "center"}
        bg="gray.50"
        py={{ base: 0, md: 4 }}
      >
        <Flex
          direction="column"
          h="100%"
          w={isMobile ? "100%" : ["100%", "100%", "70%"]}
          maxW={isMobile ? "100%" : "900px"}
          minW={isMobile ? undefined : "400px"}
          bg="white"
          borderRadius={undefined}
          boxShadow={undefined}
          overflow="hidden"
          flex="0 1 auto"
        >
          {/* Daily Limit Banner */}
          {messageLimitReached && (
            <Box
              w="full"
              bg={useColorModeValue('red.50', 'red.900')}
              borderBottom="1px"
              borderColor={useColorModeValue('red.200', 'red.700')}
              p={3}
            >
              <Text fontSize="sm" color={useColorModeValue('red.700', 'red.200')} textAlign="center" fontWeight="medium">
                ⚠️ You have reached the daily limit of {DAILY_LIMIT} messages for anonymous chat. Please sign up to continue chatting!
              </Text>
            </Box>
          )}
          <Box flex={1} minH={0} overflowY={messages.length > 0 ? "auto" : "hidden"}>
            <ChatMessages messages={messages} isLoading={isLoading} />
            <div ref={messagesEndRef} />
          </Box>
          <Box w="100%" p={isMobile ? 2 : 4} borderTop="1px" borderColor="gray.200" bg="white" flexShrink={0}>
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} isBlocked={messageLimitReached} />
          </Box>
        </Flex>
      </Flex>
      {/* Modal for daily message limit */}
      <DialogRoot open={isOpen} onOpenChange={({ open }) => setIsOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily Message Limit Reached</DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>
          <DialogBody>
            <Text>You have reached the daily limit of messages for anonymous chat. Please sign up to continue chatting!</Text>
          </DialogBody>
          <DialogFooter>
            <Button colorScheme="blue" onClick={() => window.location.href = "/signup"}>
              Sign Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default AnonymousChatWindow; 
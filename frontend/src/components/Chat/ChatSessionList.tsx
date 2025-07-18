import React, { useState } from 'react';
import {
  Box,
  Text,
  Button,
  IconButton,
  Input,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { MenuContent, MenuRoot, MenuTrigger, MenuItem, MenuSeparator } from '../ui/menu';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
} from '../ui/dialog';
import { ChatSession } from '../../types/chat';
import { useColorModeValue } from '../ui/color-mode';

interface ChatSessionListProps {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onUpdateTitle: (sessionId: string, title: string) => void;
}

const ChatSessionList: React.FC<ChatSessionListProps> = ({
  sessions,
  currentSession,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onUpdateTitle,
}) => {
  const [editingSession, setEditingSession] = useState<ChatSession | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  const handleEditClick = (session: ChatSession) => {
    setEditingSession(session);
    setEditTitle(session.title);
  };

  const handleSaveTitle = () => {
    if (editingSession && editTitle.trim()) {
      onUpdateTitle(editingSession.id, editTitle.trim());
      setEditingSession(null);
      setEditTitle('');
    }
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    setEditTitle('');
  };

  const handleDeleteClick = (session: ChatSession) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete.id);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Box h="full" bg="transparent">
      {/* Header */}
      <Flex justify="space-between" p={4} borderBottom="1px" borderColor="gray.200">
        <Text fontSize="lg" fontWeight="semibold" ml={{ base: 4, md: 0 }}>
          Chat Sessions
        </Text>
        <Icon as={FiPlus} alignSelf="center" fontSize="lg" cursor="pointer" onClick={onCreateSession} />
      </Flex>

      {/* Sessions List */}
      <Box overflowY="auto" maxH="calc(100vh - 200px)" px={4}>
        {sessions.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No chat sessions yet
          </Text>
        ) : (
          sessions.map((session) => (
            <Box
              key={session.id}
              p={currentSession?.id === session.id ? 3 : 2}
              border="none"
              borderRadius="md"
              bg={currentSession?.id === session.id ? useColorModeValue('blue.50', 'blue.700') : 'transparent'}
              cursor="pointer"
              _hover={{
                bg: currentSession?.id === session.id
                  ? useColorModeValue('blue.50', 'blue.700')
                  : useColorModeValue('gray.50', 'blue.900')
              }}
              onClick={() => onSelectSession(session)}
              mb={2}
            >
              {editingSession?.id === session.id ? (
                // Edit mode
                <Box>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter new title"
                    size="sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitle();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    autoFocus
                    mb={2}
                  />
                  <Flex>
                    <Button size="xs" colorScheme="blue" onClick={handleSaveTitle} mr={2}>
                      Save
                    </Button>
                    <Button size="xs" variant="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </Flex>
                </Box>
              ) : (
                // Display mode
                <Flex justify="space-between" align="start">
                  <Box flex={1}>
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      wordBreak="break-word"
                      color={currentSession?.id === session.id ? useColorModeValue('blue.800', 'white') : useColorModeValue('gray.800', 'gray.100')}
                      style={{ marginBottom: 2 }}
                    >
                      {session.title}
                    </Text>
                    <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
                      {formatDate(session.updated_at)}
                    </Text>
                  </Box>
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Session options"
                      >
                        <BsThreeDotsVertical />
                      </IconButton>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        closeOnSelect
                        value="edit-title"
                        py={2}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(session);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <FiEdit fontSize="18px" />
                        Edit Title
                      </MenuItem>
                      <MenuSeparator />
                      {session.is_blocked ? (
                        <MenuItem
                          closeOnSelect
                          value="delete-blocked"
                          py={2}
                          color="gray.400"
                          style={{ cursor: "not-allowed" }}
                          disabled
                        >
                          <FiTrash2 fontSize="18px" />
                          Delete Session (Blocked)
                        </MenuItem>
                      ) : (
                        <MenuItem
                          closeOnSelect
                          value="delete-session"
                          py={2}
                          color="red.500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(session);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <FiTrash2 fontSize="18px" />
                          Delete Session
                        </MenuItem>
                      )}
                    </MenuContent>
                  </MenuRoot>
                </Flex>
              )}
            </Box>
          ))
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        role="alertdialog"
        open={deleteDialogOpen}
        onOpenChange={({ open }) => setDeleteDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle color="red.600">Delete Chat Session</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Box>
              <Text color="red.600" fontWeight="medium" mb={2}>
                Warning: This action cannot be undone!
              </Text>
              <Text mb={2}>
                Are you sure you want to delete <strong>"{sessionToDelete?.title}"</strong>?
              </Text>
              <Text fontSize="sm" color="gray.600" fontWeight="medium" mb={2}>
                This action will:
              </Text>
              <Box ml={4} mb={2}>
                <Text fontSize="sm" color="gray.600">• Remove the chat session from your history</Text>
                <Text fontSize="sm" color="gray.600">• Delete all messages in this session</Text>
                <Text fontSize="sm" color="red.600" fontWeight="bold">• This action cannot be undone</Text>
              </Box>
            </Box>
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              bg="red.600"
              color="white"
              _hover={{ bg: "red.700" }}
              _active={{ bg: "red.800" }}
              onClick={handleDeleteConfirm}
            >
              Delete Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
};

export default ChatSessionList; 
import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Badge,
  Input,
  IconButton,
  Spinner,
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useCustomToast from '@/hooks/useCustomToast';
import { handleError } from '@/utils';
import type { ApiError } from '@/client/core/ApiError';
import { FaTrash, FaToggleOn, FaToggleOff, FaPlus } from 'react-icons/fa';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
} from '../ui/dialog';
import { Field } from '../ui/field';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateFlagData {
  name: string;
  description: string;
  is_enabled: boolean;
}

export const FeatureFlags: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [newFlag, setNewFlag] = useState<CreateFlagData>({
    name: '',
    description: '',
    is_enabled: true, // New flags are automatically enabled
  });
  const [confirmName, setConfirmName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const { showSuccessToast, showErrorToast } = useCustomToast();
  const queryClient = useQueryClient();

  // Fetch feature flags
  const { data: flagsData, isLoading, error } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("http://api.localhost/api/v1/feature-flags/", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch feature flags");
      }

      return await response.json();
    },
  });

  // Toggle feature flag
  const toggleMutation = useMutation({
    mutationFn: async (flagId: string) => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`http://api.localhost/api/v1/feature-flags/${flagId}/toggle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to toggle feature flag");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      showSuccessToast("Feature flag toggled successfully");
      setIsToggleDialogOpen(false);
      setSelectedFlag(null);
    },
    onError: (error: ApiError) => {
      handleError(error);
      setIsProcessing(false);
      setProcessingStep('');
    },
  });

  // Create new feature flag
  const createMutation = useMutation({
    mutationFn: async (flagData: CreateFlagData) => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("http://api.localhost/api/v1/feature-flags/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(flagData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create feature flag");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      showSuccessToast("Feature flag created and automatically enabled");
      setNewFlag({ name: '', description: '', is_enabled: true });
      setIsCreateOpen(false);
    },
    onError: (error: ApiError) => {
      handleError(error);
    },
  });

  // Delete feature flag
  const deleteMutation = useMutation({
    mutationFn: async (flagId: string) => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`http://api.localhost/api/v1/feature-flags/${flagId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete feature flag");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      showSuccessToast("Feature flag deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedFlag(null);
      setConfirmName('');
    },
    onError: (error: ApiError) => {
      handleError(error);
      setIsProcessing(false);
      setProcessingStep('');
    },
  });

  const handleToggleClick = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setIsToggleDialogOpen(true);
  };

  const handleToggleConfirm = async () => {
    if (!selectedFlag) return;
    
    setIsProcessing(true);
    setProcessingStep(`Toggling ${selectedFlag.name}...`);
    
    try {
      await toggleMutation.mutateAsync(selectedFlag.id);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleDeleteClick = (flag: FeatureFlag) => {
    if (flag.is_predefined) {
      showErrorToast("Predefined flags cannot be deleted");
      return;
    }
    setSelectedFlag(flag);
    setIsDeleteDialogOpen(true);
    setConfirmName('');
  };

  const handleDeleteConfirm = async () => {
    if (!selectedFlag) return;
    
    if (confirmName !== selectedFlag.name) {
      showErrorToast("Name doesn't match. Please enter the exact name to confirm deletion.");
      return;
    }

    setIsProcessing(true);
    setProcessingStep(`Deleting ${selectedFlag.name}...`);
    
    try {
      await deleteMutation.mutateAsync(selectedFlag.id);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleCreate = () => {
    if (!newFlag.name.trim() || !newFlag.description.trim()) {
      showErrorToast("Name and description are required");
      return;
    }
    createMutation.mutate(newFlag);
  };

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading feature flags...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Text color="red.500">Error loading feature flags</Text>
      </Box>
    );
  }

  const flags: FeatureFlag[] = flagsData?.data || [];
  
  // Sort flags by active status (active first), then by name
  const sortedFlags = [...flags].sort((a, b) => {
    if (a.is_enabled !== b.is_enabled) {
      return b.is_enabled ? 1 : -1; // Active flags first
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <Box>
      <Button value="add-feature" my={4} onClick={() => setIsCreateOpen(true)}>
        <FaPlus fontSize="16px" />
        Add New Feature
      </Button>
      
      <VStack gap={4} align="stretch">
        {sortedFlags.map((flag) => (
          <Box key={flag.id} border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <HStack justify="space-between" mb={3}>
              <VStack align="start" gap={1}>
                <Heading size="sm">{flag.name}</Heading>
                <Text fontSize="sm" color="gray.600">
                  {flag.description}
                </Text>
              </VStack>
              <HStack gap={2}>
                <Badge colorPalette={flag.is_enabled ? 'green' : 'gray'}>
                  {flag.is_enabled ? 'Active' : 'Inactive'}
                </Badge>
                {flag.is_predefined && (
                  <Badge colorPalette="blue">Predefined</Badge>
                )}
                <IconButton
                  size="md"
                  variant="ghost"
                  aria-label={flag.is_enabled ? "Disable flag" : "Enable flag"}
                  onClick={() => handleToggleClick(flag)}
                >
                  {flag.is_enabled ? <FaToggleOn fontSize="20px" /> : <FaToggleOff fontSize="20px" />}
                </IconButton>
                {!flag.is_predefined && (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label="Delete flag"
                    onClick={() => handleDeleteClick(flag)}
                  >
                    <FaTrash />
                  </IconButton>
                )}
              </HStack>
            </HStack>
            <HStack gap={4} fontSize="sm" color="gray.600">
              <Text>Created: {new Date(flag.created_at).toLocaleDateString()}</Text>
              <Text>Updated: {new Date(flag.updated_at).toLocaleDateString()}</Text>
            </HStack>
          </Box>
        ))}
        
        {sortedFlags.length === 0 && (
          <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <Text textAlign="center" color="gray.500">
              No feature flags found.
            </Text>
          </Box>
        )}
      </VStack>

      {/* Create New Flag Dialog */}
      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        open={isCreateOpen}
        onOpenChange={({ open }) => setIsCreateOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Feature Flag</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              Create a new feature flag to control functionality in the spiritual chatbot. New flags are automatically enabled.
            </Text>
            <VStack gap={4}>
              <Field
                required
                label="Flag Name"
              >
                <Input
                  value={newFlag.name}
                  onChange={(e) =>
                    setNewFlag({ ...newFlag, name: e.target.value })
                  }
                  placeholder="Enter flag name"
                />
              </Field>
              <Field
                required
                label="Description"
              >
                <Input
                  value={newFlag.description}
                  onChange={(e) =>
                    setNewFlag({ ...newFlag, description: e.target.value })
                  }
                  placeholder="Enter flag description"
                />
              </Field>
            </VStack>
          </DialogBody>
          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              colorScheme="blue"
              onClick={handleCreate}
              loading={createMutation.isPending}
            >
              Create Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Toggle Confirmation Dialog */}
      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        role="alertdialog"
        open={isToggleDialogOpen}
        onOpenChange={({ open }) => setIsToggleDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedFlag?.is_enabled ? 'Disable' : 'Enable'} Feature Flag
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isProcessing ? (
              <VStack gap={4}>
                <Text fontWeight="medium">
                  {selectedFlag?.is_enabled ? 'Disabling' : 'Enabling'}: {selectedFlag?.name}
                </Text>
                <Spinner size="md" />
                <Text fontSize="sm" color="gray.600">{processingStep}</Text>
              </VStack>
            ) : (
              <VStack gap={4} align="stretch">
                <Text>
                  Are you sure you want to {selectedFlag?.is_enabled ? 'disable' : 'enable'} <strong>{selectedFlag?.name}</strong>?
                </Text>
                <Text fontSize="sm" color="gray.600">
                  {selectedFlag?.is_enabled 
                    ? 'This will turn off the feature and it will no longer be available to users.'
                    : 'This will turn on the feature and make it available to users.'
                  }
                </Text>
              </VStack>
            )}
          </DialogBody>
          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button 
                variant="outline" 
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              colorScheme={selectedFlag?.is_enabled ? "red" : "green"}
              onClick={handleToggleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : (selectedFlag?.is_enabled ? "Disable" : "Enable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        role="alertdialog"
        open={isDeleteDialogOpen}
        onOpenChange={({ open }) => setIsDeleteDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle color="red.600">Delete Feature Flag</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isProcessing ? (
              <VStack gap={4}>
                <Text color="red.600" fontWeight="medium">Deleting: {selectedFlag?.name}</Text>
                <Spinner size="md" color="red.500" />
                <Text fontSize="sm" color="gray.600">{processingStep}</Text>
              </VStack>
            ) : (
              <VStack gap={4} align="stretch">
                <Text color="red.600" fontWeight="medium">
                  Warning: This action cannot be undone!
                </Text>
                <Text>
                  Are you sure you want to delete <strong>{selectedFlag?.name}</strong>?
                </Text>
                
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  This action will:
                </Text>
                <VStack align="start" gap={1} ml={4}>
                  <Text fontSize="sm" color="gray.600">• Remove the feature flag from the system</Text>
                  <Text fontSize="sm" color="gray.600">• Disable any functionality controlled by this flag</Text>
                  <Text fontSize="sm" color="red.600" fontWeight="bold">• This action cannot be undone</Text>
                </VStack>
                
                <Text fontSize="sm" color="gray.600" mt={2}>
                  To confirm deletion, please enter the exact name: <strong>{selectedFlag?.name}</strong>
                </Text>
                <Input
                  placeholder="Enter flag name to confirm"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  disabled={isProcessing}
                  borderColor={confirmName === selectedFlag?.name ? "green.300" : "gray.300"}
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
                />
              </VStack>
            )}
          </DialogBody>
          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button 
                variant="outline" 
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              bg="red.600"
              color="white"
              _hover={{ bg: "red.700" }}
              _active={{ bg: "red.800" }}
              onClick={handleDeleteConfirm}
              disabled={isProcessing || confirmName !== selectedFlag?.name}
            >
              {isProcessing ? "Deleting..." : "Delete Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
}; 
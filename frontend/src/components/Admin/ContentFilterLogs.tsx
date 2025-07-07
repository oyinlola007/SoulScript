import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Input,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import {
  PaginationRoot,
  PaginationPrevTrigger,
  PaginationItems,
  PaginationNextTrigger,
} from "@/components/ui/pagination.tsx"


interface ContentFilterLog {
  id: string;
  user_id: string;
  session_id: string | null;
  content_type: string;
  original_content: string;
  blocked_reason: string;
  created_at: string;
}

interface FilterStats {
  total_violations: number;
  today_violations: number;
  user_input_violations: number;
  ai_response_violations: number;
}

export const ContentFilterLogs: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const skip = (page - 1) * limit;

  // Fetch content filter logs
  const { data: logsData, isLoading, error } = useQuery({
    queryKey: ['content-filter-logs', skip, limit, selectedUser, selectedType],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      let url = `http://api.localhost/api/v1/content-filter/logs?skip=${skip}&limit=${limit}`;
      if (selectedUser) url += `&user_id=${selectedUser}`;
      if (selectedType) url += `&content_type=${selectedType}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch content filter logs");
      }

      return await response.json();
    },
  });

  // Fetch content filter statistics
  const { data: statsData } = useQuery({
    queryKey: ['content-filter-stats'],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("http://api.localhost/api/v1/content-filter/statistics", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch statistics");
      }

      return await response.json();
    },
  });

  const logs: ContentFilterLog[] = logsData?.data || [];
  const stats: FilterStats = statsData || {
    total_violations: 0,
    today_violations: 0,
    user_input_violations: 0,
    ai_response_violations: 0,
  };

  const getContentPreview = (content: string) => {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  };

  if (isLoading) {
    return (
      <Box p={6}>
        <Text>Loading content filter logs...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={6}>
        <Text color="red.500">Error loading content filter logs</Text>
      </Box>
    );
  }

  return (
    <Box>
      <VStack gap={4} align="stretch">

        {/* Statistics */}
        <Box p={4} border="1px" borderColor="gray.200" borderRadius="md" bg="white">
          <VStack gap={3}>
            <HStack gap={6}>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="red.500">
                  {stats.total_violations}
                </Text>
                <Text fontSize="sm" color="gray.600">Total Violations</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="orange.500">
                  {stats.today_violations}
                </Text>
                <Text fontSize="sm" color="gray.600">Today's Violations</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="blue.500">
                  {stats.user_input_violations}
                </Text>
                <Text fontSize="sm" color="gray.600">User Input Violations</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="purple.500">
                  {stats.ai_response_violations}
                </Text>
                <Text fontSize="sm" color="gray.600">AI Response Violations</Text>
              </Box>
            </HStack>
          </VStack>
        </Box>

        <Box borderTop="1px" borderColor="gray.200" pt={4} />

        {/* Filters */}
        <HStack gap={4} align="end">
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>Filter by User ID:</Text>
            <Input
              placeholder="Enter user ID"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              size="sm"
              width="200px"
            />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>Filter by Type:</Text>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                width: '150px'
              }}
            >
              <option value="">All Types</option>
              <option value="user_input">User Input</option>
              <option value="ai_response">AI Response</option>
            </select>
          </Box>
          <Button
            size="sm"
            onClick={() => {
              setSelectedUser('');
              setSelectedType('');
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        </HStack>

        {/* Logs Table */}
        <Box border="1px" borderColor="gray.200" borderRadius="md" bg="white" overflow="auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>User ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Reason</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Content Preview</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Session ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                  <td style={{ padding: '12px', fontSize: '12px', fontFamily: 'monospace' }}>
                    {log.user_id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '12px' }}>
                    <Badge
                      colorScheme={log.content_type === 'user_input' ? 'red' : 'purple'}
                      fontSize="xs"
                    >
                      {log.content_type}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <Text fontSize="xs" color="red.600" fontWeight="medium">
                      {log.blocked_reason}
                    </Text>
                  </td>
                  <td style={{ padding: '12px', maxWidth: '200px' }}>
                    <Text fontSize="xs">
                      {getContentPreview(log.original_content)}
                    </Text>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', fontFamily: 'monospace' }}>
                    {log.session_id ? log.session_id.substring(0, 8) + '...' : 'N/A'}
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>

        {/* Pagination */}
        <Box display="flex" justifyContent="flex-end" mt={4}>
          <PaginationRoot
            count={logsData?.count || 0}
            pageSize={limit}
            onPageChange={({ page }) => setPage(page)}
            page={page}
          >
            <HStack>
              <PaginationPrevTrigger />
              <PaginationItems />
              <PaginationNextTrigger />
            </HStack>
          </PaginationRoot>
        </Box>
      </VStack>
    </Box>
  );
}; 
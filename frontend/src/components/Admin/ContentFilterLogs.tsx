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
import { useColorModeValue } from '../ui/color-mode';
import { OpenAPI } from '@/client/core/OpenAPI';
import { request } from '@/client/core/request';

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

// Content Filter Service
class ContentFilterService {
  static async getLogs(skip: number, limit: number, userId?: string, contentType?: string): Promise<{ data: ContentFilterLog[]; count: number }> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "GET",
        url: `/api/v1/content-filter/logs`,
        query: {
          skip,
          limit,
          ...(userId && { user_id: userId }),
          ...(contentType && { content_type: contentType }),
        },
      });

      return response as { data: ContentFilterLog[]; count: number };
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }

  static async getStatistics(): Promise<FilterStats> {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Temporarily set the token in OpenAPI config
    const originalToken = OpenAPI.TOKEN;
    OpenAPI.TOKEN = token;

    try {
      const response = await request(OpenAPI, {
        method: "GET",
        url: `/api/v1/content-filter/statistics`,
      });

      return response as FilterStats;
    } finally {
      // Restore original token
      OpenAPI.TOKEN = originalToken;
    }
  }
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
    queryFn: async (): Promise<{ data: ContentFilterLog[]; count: number }> => {
      return await ContentFilterService.getLogs(skip, limit, selectedUser || undefined, selectedType || undefined);
    },
  });

  // Fetch content filter statistics
  const { data: statsData } = useQuery({
    queryKey: ['content-filter-stats'],
    queryFn: async (): Promise<FilterStats> => {
      return await ContentFilterService.getStatistics();
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
        <Box p={4} border="1px" borderColor={useColorModeValue('gray.200', 'gray.700')} borderRadius="md" bg={useColorModeValue('white', 'gray.800')}>
          <VStack gap={3}>
            <HStack gap={6}>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="red.500">
                  {stats.total_violations}
                </Text>
                <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>Total Violations</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="orange.500">
                  {stats.today_violations}
                </Text>
                <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>Today's Violations</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="blue.500">
                  {stats.user_input_violations}
                </Text>
                <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>User Input Violations</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="2xl" fontWeight="bold" color="purple.500">
                  {stats.ai_response_violations}
                </Text>
                <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>AI Response Violations</Text>
              </Box>
            </HStack>
          </VStack>
        </Box>

        <Box borderTop="1px" borderColor={useColorModeValue('gray.200', 'gray.700')} pt={4} />

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
        <Box border="1px" borderColor={useColorModeValue('gray.200', 'gray.700')} borderRadius="md" bg={useColorModeValue('white', 'gray.800')} overflow="auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'transparent' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${useColorModeValue('#e2e8f0', '#2d3748')}` }}>
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
                <tr key={log.id} style={{ borderBottom: useColorModeValue('1px solid #f7fafc', '1px solid #2d3748'), background: 'transparent' }}>
                  <td style={{ padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: useColorModeValue('#1a202c', '#e2e8f0') }}>
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
                  <td style={{ padding: '12px', maxWidth: '200px', color: useColorModeValue('#1a202c', '#e2e8f0') }}>
                    <Text fontSize="xs">
                      {getContentPreview(log.original_content)}
                    </Text>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: useColorModeValue('#1a202c', '#e2e8f0') }}>
                    {log.session_id ? log.session_id.substring(0, 8) + '...' : 'N/A'}
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: useColorModeValue('#1a202c', '#e2e8f0') }}>
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
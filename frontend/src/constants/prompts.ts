/**
 * Centralized prompts for the SoulScript frontend application.
 * 
 * This file contains all prompts and messages used throughout the frontend
 * for easy management, modification, and consistency.
 */

// =============================================================================
// CONTENT FILTERING MESSAGES
// =============================================================================

export const BLOCKED_CONTENT_MESSAGE = `I understand you may be going through a difficult time. For your safety and well-being, I encourage you to seek professional help from qualified mental health professionals, counselors, or crisis support services who can provide the appropriate care and support you need.

This chat session has been blocked due to the content of your message. If you need immediate help, please contact a crisis helpline or speak with a mental health professional.`;

// =============================================================================
// ERROR MESSAGES
// =============================================================================

export const BLOCKED_SESSION_DELETE_ERROR = "Cannot delete blocked sessions. They are retained for safety and compliance purposes.";

// =============================================================================
// UI MESSAGES
// =============================================================================

export const CHAT_SELECT_MESSAGE = "Select a chat session or create a new one";
export const START_NEW_CHAT_BUTTON = "Start New Chat";
export const NO_CHAT_SESSIONS_MESSAGE = "No chat sessions yet";
export const LOADING_CHAT_SESSIONS = "Loading content filter logs...";
export const ERROR_LOADING_CHAT_SESSIONS = "Error loading content filter logs"; 
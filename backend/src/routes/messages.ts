import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger, logError } from '../logger';
import { ApiError, CreateMessageRequest, AuthenticatedRequest, SocraticModality } from '../types/index';
import authMiddleware from '../middleware/auth';
import { OpenAIService } from '../services/openai.service';
import { DocumentService } from '../services/document.service';
import { getTaskQueue } from '../queue/task.queue';
import { isSuperAdmin } from '../utils/roles';
import { resolveOpenAICredentials } from '../utils/openai-credentials';

const router = Router();

// Protect all routes with authentication
router.use(authMiddleware);

/**
 * GET /api/sessions/:sessionId/messages
 * Get all messages in a session
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { sessionId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Verify session ownership (Super Admin can access any)
    let sessionQuery = supabaseAdmin.from('sessions').select('id').eq('id', sessionId);
    if (!isSuperAdmin(user.role)) {
      sessionQuery = sessionQuery.eq('user_id', user.id);
    }
    const { data: session, error: sessionError } = await sessionQuery.single();

    if (sessionError || !session) {
      throw new ApiError(404, 'Session not found', 'NOT_FOUND');
    }

    const { data: messages, error, count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) {
      throw new ApiError(500, 'Failed to fetch messages', 'FETCH_ERROR');
    }

    res.status(200).json({
      data: messages || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return void res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logError(error as Error, {
      action: 'GET /api/sessions/:sessionId/messages',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch messages',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/messages
 * Create a new message and get Socratic AI response
 * Supports streaming
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const {
      session_id: sessionId,
      content,
      modality_type: modalityType,
      document_id: documentId,
    }: CreateMessageRequest = req.body;

    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required', 'MISSING_SESSION_ID');
    }

    if (!content || content.trim().length === 0) {
      throw new ApiError(400, 'Message content is required', 'MISSING_CONTENT');
    }

    if (content.length > 10000) {
      throw new ApiError(400, 'Message too long (max 10000 characters)', 'CONTENT_TOO_LONG');
    }

    // Verify session ownership (Super Admin can access any)
    let sessionQuery = supabaseAdmin
      .from('sessions')
      .select('id, project_id')
      .eq('id', sessionId);
    if (!isSuperAdmin(user.role)) {
      sessionQuery = sessionQuery.eq('user_id', user.id);
    }
    const { data: session, error: sessionError } = await sessionQuery.single();

    if (sessionError || !session) {
      throw new ApiError(404, 'Session not found', 'NOT_FOUND');
    }

    logger.debug({ userId: user.id, sessionId, content }, 'Creating message');

    // Save user message
    const { data: userMessage, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        session_id: sessionId,
        document_id: documentId || null,
        role: 'user',
        content,
        modality_type: modalityType || null,
      })
      .select()
      .single();

    if (messageError || !userMessage) {
      throw new ApiError(500, 'Failed to create message', 'MESSAGE_ERROR');
    }

    // Bump session activity immediately so it stays in sidebar history
    await supabaseAdmin
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Get OpenAI credentials (per-user key, or server OPENAI_API_KEY fallback)
    const credentials = await resolveOpenAICredentials(user.id);

    if (!credentials) {
      logger.warn({ userId: user.id }, 'No OpenAI API key found');
      throw new ApiError(
        400,
        'OpenAI API key is not configured. Set OPENAI_API_KEY on the server or add a key for this user.',
        'MISSING_API_KEY'
      );
    }

    logger.debug(
      { userId: user.id, keySource: credentials.source, model: credentials.modelName },
      'Using OpenAI credentials'
    );

    const aiService = new OpenAIService(credentials.apiKey, credentials.modelName);

    // Determine modality — same credential path for every Socratic mode
    let modality = (modalityType as SocraticModality) || 'socratic_auditor';
    if (!modalityType) {
      modality = await aiService.classifyIntent(content);
    }

    // Get document context if provided
    let documentContext = '';
    if (documentId) {
      const docService = new DocumentService();
      documentContext = await docService.parseDocument(documentId, user.id);
    }

    // Get previous messages for context
    const { data: previousMessages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10); // Last 10 messages for context

    const previousMessagesFormatted = (previousMessages || []).slice(-5).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Generate Socratic response
    const socraticResponse = await aiService.generateSocraticResponse({
      modality,
      userStatement: content,
      documentContext: documentContext || undefined,
      previousMessages: previousMessagesFormatted,
      userTier: 'strategist', // TODO: fetch from user subscription
    });

    // Save AI response
    const { data: aiMessage, error: aiError } = await supabaseAdmin
      .from('messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: socraticResponse.response,
        modality_type: modality,
        metadata: {
          token_count: socraticResponse.usageMetrics.totalTokens,
          reasoning: socraticResponse.reasoning,
        },
      })
      .select()
      .single();

    if (aiError) {
      logger.warn({ error: aiError }, 'Failed to save AI response');
      // Continue anyway - user message was saved
    }

    // Keep session in recent history (ChatGPT/Claude-style sidebar ordering)
    await supabaseAdmin
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Log usage
    await supabaseAdmin.from('usage_logs').insert({
      user_id: user.id,
      audit_type: modality,
      tokens_used: socraticResponse.usageMetrics.totalTokens,
      billing_cycle_id: new Date().toISOString().split('T')[0], // Day-based for MVP
    });

    logger.info(
      {
        userId: user.id,
        sessionId,
        modality,
        tokens: socraticResponse.usageMetrics.totalTokens,
      },
      'Socratic response generated'
    );

    res.status(201).json({
      message: userMessage,
      ai_response: aiMessage || null,
      usage: socraticResponse.usageMetrics,
      modality,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return void res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logError(error as Error, {
      action: 'POST /api/messages',
      userId: (req as AuthenticatedRequest).user.id,
    });

    const openAiMessage = error instanceof Error ? error.message : 'Failed to create message';
    const statusCode = /unsupported parameter|unsupported value|invalid|model/i.test(openAiMessage)
      ? 502
      : 500;

    res.status(statusCode).json({
      error: {
        code: statusCode === 502 ? 'AI_PROVIDER_ERROR' : 'INTERNAL_ERROR',
        message: openAiMessage || 'Failed to create message',
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/messages/:messageId/stream
 * Stream a Socratic response in real-time
 */
router.post('/:messageId/stream', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { session_id: sessionId, content, modality_type: modalityType } = req.body;

    if (!sessionId || !content) {
      res.write('data: {"error": "Missing session_id or content"}\n\n');
      res.end();
      return;
    }

    // Verify session (Super Admin can access any)
    let sessionQuery = supabaseAdmin.from('sessions').select('id').eq('id', sessionId);
    if (!isSuperAdmin(user.role)) {
      sessionQuery = sessionQuery.eq('user_id', user.id);
    }
    const { data: session } = await sessionQuery.single();

    if (!session) {
      res.write('data: {"error": "Session not found"}\n\n');
      res.end();
      return;
    }

    // Get OpenAI credentials (per-user key, or server OPENAI_API_KEY fallback)
    const credentials = await resolveOpenAICredentials(user.id);

    if (!credentials) {
      res.write('data: {"error": "No API key configured"}\n\n');
      res.end();
      return;
    }

    const aiService = new OpenAIService(credentials.apiKey, credentials.modelName);

    // Determine modality
    let modality = (modalityType as SocraticModality) || 'socratic_auditor';
    if (!modalityType) {
      modality = await aiService.classifyIntent(content);
    }

    // Stream response
    for await (const chunk of aiService.streamSocraticResponse({
      modality,
      userStatement: content,
      userTier: 'strategist',
    })) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write('data: {"done": true}\n\n');
    res.end();
  } catch (error) {
    logger.error({ error }, 'Stream error');
    res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
    res.end();
  }
});

export default router;

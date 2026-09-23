import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { supabaseAdmin } from '../config/supabase';
import { logger, logError } from '../logger';
import { DocumentRecord, SupportedFileType, ApiError } from '../types/index';

/**
 * Document service for handling file uploads and parsing
 */
export class DocumentService {
  private maxFileSize: number;
  private supportedTypes: string[];

  constructor(
    maxFileSizeMB: number = 10,
    supportedTypes: string[] = ['pdf', 'docx', 'txt', 'md', 'json', 'pptx', 'xlsx']
  ) {
    this.maxFileSize = maxFileSizeMB * 1024 * 1024;
    this.supportedTypes = supportedTypes;
  }

  /**
   * Upload a document to Supabase Storage
   */
  async uploadDocument(
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    },
    userId: string,
    projectId: string
  ): Promise<DocumentRecord> {
    try {
      // Validate file size
      if (file.buffer.length > this.maxFileSize) {
        throw new ApiError(
          400,
          `File size exceeds limit of ${this.maxFileSize / 1024 / 1024}MB`,
          'FILE_TOO_LARGE'
        );
      }

      // Extract file type
      const fileType = this.extractFileType(file.originalname);

      if (!this.supportedTypes.includes(fileType)) {
        throw new ApiError(
          400,
          `File type ${fileType} not supported. Supported types: ${this.supportedTypes.join(', ')}`,
          'UNSUPPORTED_FILE_TYPE'
        );
      }

      // Validate MIME type matches file extension
      if (!this.isValidMimeType(file.mimetype, fileType)) {
        throw new ApiError(
          400,
          `MIME type ${file.mimetype} does not match file extension ${fileType}`,
          'INVALID_MIME_TYPE'
        );
      }

      // Generate unique filename (prevent collisions)
      const timestamp = Date.now();
      const uniqueId = uuidv4().split('-')[0];
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${userId}/${projectId}/${timestamp}-${uniqueId}-${sanitizedName}`;

      logger.debug(
        {
          userId,
          projectId,
          fileName: file.originalname,
          fileSize: file.buffer.length,
          storagePath,
        },
        'Uploading document'
      );

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabaseAdmin.storage
        .from('documents')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        logger.error({ error: uploadError }, 'Failed to upload to storage');
        throw new ApiError(500, 'Failed to upload document', 'STORAGE_ERROR');
      }

      // Create document record in database
      const documentRecord: Omit<DocumentRecord, 'id'> = {
        user_id: userId,
        project_id: projectId,
        filename: file.originalname,
        file_path: storagePath,
        file_type: fileType as SupportedFileType,
        size: file.buffer.length,
        mime_type: file.mimetype,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: dbData, error: dbError } = await supabaseAdmin
        .from('documents')
        .insert(documentRecord)
        .select()
        .single();

      if (dbError || !dbData) {
        // Clean up storage if database insert fails
        await supabaseAdmin.storage.from('documents').remove([storagePath]);
        logger.error({ error: dbError }, 'Failed to create document record');
        throw new ApiError(500, 'Failed to save document', 'DATABASE_ERROR');
      }

      logger.info(
        {
          userId,
          projectId,
          documentId: dbData.id,
          fileSize: file.buffer.length,
        },
        'Document uploaded successfully'
      );

      return dbData as DocumentRecord;
    } catch (error) {
      logError(error as Error, {
        action: 'uploadDocument',
        userId,
        projectId,
      });
      throw error;
    }
  }

  /**
   * Parse document content based on file type
   */
  async parseDocument(documentId: string, userId: string): Promise<string> {
    try {
      // Fetch document metadata
      const { data: doc, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !doc) {
        throw new ApiError(404, 'Document not found', 'NOT_FOUND');
      }

      const document = doc as DocumentRecord;

      logger.debug(
        {
          documentId,
          fileType: document.file_type,
          fileSize: document.size,
        },
        'Parsing document'
      );

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('documents')
        .download(document.file_path);

      if (downloadError || !fileData) {
        throw new ApiError(500, 'Failed to download document', 'DOWNLOAD_ERROR');
      }

      // Parse based on file type
      let content: string;

      switch (document.file_type) {
        case 'pdf':
          content = await this.parsePDF(fileData);
          break;
        case 'docx':
          content = await this.parseDOCX(fileData);
          break;
        case 'txt':
          content = await this.parseTXT(fileData);
          break;
        case 'md':
          content = await this.parseMD(fileData);
          break;
        case 'json':
          content = await this.parseJSON(fileData);
          break;
        case 'xlsx':
          content = await this.parseXLSX(fileData);
          break;
        case 'pptx':
          content = await this.parsePPTX(fileData);
          break;
        default:
          throw new ApiError(400, `Unsupported file type: ${document.file_type}`, 'UNSUPPORTED_TYPE');
      }

      // Store preview in metadata for display
      const preview = content.substring(0, 500);
      const wordCount = content.split(/\s+/).length;

      // Update document metadata
      await supabaseAdmin
        .from('documents')
        .update({
          metadata: {
            preview,
            word_count: wordCount,
          },
        })
        .eq('id', documentId);

      logger.debug(
        {
          documentId,
          contentLength: content.length,
          wordCount,
        },
        'Document parsed successfully'
      );

      return content;
    } catch (error) {
      logError(error as Error, {
        action: 'parseDocument',
        documentId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Parse PDF file
   */
  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new ApiError(500, 'Failed to parse PDF', 'PDF_PARSE_ERROR');
    }
  }

  /**
   * Parse DOCX file
   */
  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new ApiError(500, 'Failed to parse DOCX', 'DOCX_PARSE_ERROR');
    }
  }

  /**
   * Parse TXT file
   */
  private async parseTXT(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      throw new ApiError(500, 'Failed to parse TXT', 'TXT_PARSE_ERROR');
    }
  }

  /**
   * Parse MD file
   */
  private async parseMD(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      throw new ApiError(500, 'Failed to parse MD', 'MD_PARSE_ERROR');
    }
  }

  /**
   * Parse JSON file
   */
  private async parseJSON(buffer: Buffer): Promise<string> {
    try {
      const content = buffer.toString('utf-8');
      const json = JSON.parse(content);
      // Convert JSON to readable format
      return JSON.stringify(json, null, 2);
    } catch (error) {
      throw new ApiError(500, 'Failed to parse JSON', 'JSON_PARSE_ERROR');
    }
  }

  /**
   * Parse XLSX by extracting shared strings / cell text from the Office zip
   */
  private async parseXLSX(buffer: Buffer): Promise<string> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const shared = await zip.file('xl/sharedStrings.xml')?.async('string');
      const texts: string[] = [];

      if (shared) {
        const matches = shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g);
        for (const match of matches) {
          if (match[1]?.trim()) texts.push(match[1].trim());
        }
      }

      // Fallback: pull readable text from worksheet XML
      if (texts.length === 0) {
        const sheets = Object.keys(zip.files).filter((n) => n.startsWith('xl/worksheets/'));
        for (const sheet of sheets) {
          const xml = await zip.file(sheet)?.async('string');
          if (!xml) continue;
          const matches = xml.matchAll(/<v>([^<]+)<\/v>/g);
          for (const match of matches) {
            if (match[1]?.trim()) texts.push(match[1].trim());
          }
        }
      }

      const content = texts.join(' ').trim();
      if (!content) {
        throw new Error('No extractable text');
      }
      return content;
    } catch (error) {
      throw new ApiError(500, 'Failed to parse XLSX', 'XLSX_PARSE_ERROR');
    }
  }

  /**
   * Parse PPTX by extracting text from slide XML
   */
  private async parsePPTX(buffer: Buffer): Promise<string> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const slides = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort();

      const texts: string[] = [];
      for (const slide of slides) {
        const xml = await zip.file(slide)?.async('string');
        if (!xml) continue;
        const matches = xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
        for (const match of matches) {
          if (match[1]?.trim()) texts.push(match[1].trim());
        }
      }

      const content = texts.join('\n').trim();
      if (!content) {
        throw new Error('No extractable text');
      }
      return content;
    } catch (error) {
      throw new ApiError(500, 'Failed to parse PPTX', 'PPTX_PARSE_ERROR');
    }
  }

  /**
   * Delete document and associated storage
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      // Fetch document
      const { data: doc, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !doc) {
        throw new ApiError(404, 'Document not found', 'NOT_FOUND');
      }

      const document = doc as DocumentRecord;

      // Delete from storage
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) {
        logger.warn({ error: storageError }, 'Failed to delete from storage');
        // Continue anyway - delete DB record
      }

      // Delete from database
      const { error: dbError } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId);

      if (dbError) {
        throw new ApiError(500, 'Failed to delete document', 'DELETE_ERROR');
      }

      logger.info({ documentId, userId }, 'Document deleted');
    } catch (error) {
      logError(error as Error, {
        action: 'deleteDocument',
        documentId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Extract file type from filename
   */
  private extractFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase().substring(1);
    return ext || 'unknown';
  }

  /**
   * Validate MIME type matches file extension
   */
  private isValidMimeType(mimeType: string, fileType: string): boolean {
    const mimeTypeMap: Record<string, string[]> = {
      pdf: ['application/pdf'],
      docx: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream',
      ],
      xlsx: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
      ],
      pptx: [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/octet-stream',
      ],
      txt: ['text/plain'],
      md: ['text/plain', 'text/markdown', 'text/x-markdown'],
      json: ['application/json'],
    };

    const allowedTypes = mimeTypeMap[fileType] || [];
    return allowedTypes.includes(mimeType);
  }

  /**
   * List documents for a project
   */
  async listDocuments(
    projectId: string,
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ documents: DocumentRecord[]; total: number }> {
    try {
      // Get total count
      const { count: total, error: countError } = await supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (countError) {
        throw new ApiError(500, 'Failed to count documents', 'COUNT_ERROR');
      }

      // Get paginated documents
      const { data: documents, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (fetchError) {
        throw new ApiError(500, 'Failed to fetch documents', 'FETCH_ERROR');
      }

      return {
        documents: documents as DocumentRecord[],
        total: total || 0,
      };
    } catch (error) {
      logError(error as Error, {
        action: 'listDocuments',
        projectId,
        userId,
      });
      throw error;
    }
  }
}

/**
 * Create a document service instance
 */
export function createDocumentService(): DocumentService {
  return new DocumentService(
    parseInt(process.env.MAX_FILE_SIZE_MB || '10'),
    (process.env.SUPPORTED_FILE_TYPES || 'pdf,docx,txt,md,json,pptx,xlsx').split(',')
  );
}

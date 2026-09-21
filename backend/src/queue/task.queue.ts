import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

/**
 * Task types
 */
export type TaskType = 'generate_socratic_response' | 'parse_document' | 'send_email';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  data: Record<string, any>;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retries: number;
  maxRetries: number;
}

/**
 * Task handler function type
 */
export type TaskHandler = (data: Record<string, any>) => Promise<any>;

/**
 * In-memory task queue implementation
 * Note: This is suitable for MVP only. In production, use Redis/Bull or AWS SQS
 */
export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private handlers: Map<TaskType, TaskHandler> = new Map();
  private processingQueue: string[] = [];
  private concurrency: number;
  private activeProcessing: number = 0;

  constructor(concurrency: number = 2) {
    this.concurrency = concurrency;
    this.startProcessor();
  }

  /**
   * Register a task handler
   */
  public registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
    logger.info({ taskType: type }, 'Task handler registered');
  }

  /**
   * Add a task to the queue
   */
  public async addTask(
    type: TaskType,
    data: Record<string, any>,
    maxRetries: number = 3
  ): Promise<string> {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for task type: ${type}`);
    }

    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      type,
      status: TaskStatus.PENDING,
      data,
      retries: 0,
      maxRetries,
      createdAt: new Date(),
    };

    this.tasks.set(taskId, task);
    this.processingQueue.push(taskId);

    logger.debug({ taskId, type }, 'Task added to queue');

    return taskId;
  }

  /**
   * Get task status
   */
  public getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Wait for task completion
   */
  public async waitForTask(taskId: string, timeoutMs: number = 30000): Promise<Task> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkTask = () => {
        const task = this.tasks.get(taskId);

        if (!task) {
          reject(new Error('Task not found'));
          return;
        }

        if (task.status === TaskStatus.COMPLETED) {
          resolve(task);
          return;
        }

        if (task.status === TaskStatus.FAILED) {
          reject(new Error(task.error || 'Task failed'));
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Task timeout'));
          return;
        }

        setTimeout(checkTask, 100);
      };

      checkTask();
    });
  }

  /**
   * Start the task processor
   */
  private startProcessor(): void {
    setInterval(() => {
      this.processNext();
    }, 100);
  }

  /**
   * Process the next task in queue
   */
  private async processNext(): Promise<void> {
    // Don't exceed concurrency limit
    if (this.activeProcessing >= this.concurrency) {
      return;
    }

    // Find next pending task
    const taskId = this.processingQueue.shift();

    if (!taskId) {
      return;
    }

    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn({ taskId }, 'Task not found in map');
      return;
    }

    if (task.status !== TaskStatus.PENDING) {
      logger.warn({ taskId, status: task.status }, 'Task not in pending state');
      return;
    }

    // Process the task
    this.activeProcessing++;
    await this.executeTask(task);
    this.activeProcessing--;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    const handler = this.handlers.get(task.type);

    if (!handler) {
      task.status = TaskStatus.FAILED;
      task.error = `No handler for task type: ${task.type}`;
      task.completedAt = new Date();
      logger.error({ taskId: task.id, type: task.type }, 'No handler found');
      return;
    }

    try {
      task.status = TaskStatus.PROCESSING;
      task.startedAt = new Date();

      logger.debug({ taskId: task.id, type: task.type }, 'Processing task');

      // Execute handler
      const result = await handler(task.data);

      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.completedAt = new Date();

      logger.info(
        {
          taskId: task.id,
          type: task.type,
          duration: Date.now() - task.startedAt!.getTime(),
        },
        'Task completed'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.warn(
        {
          taskId: task.id,
          type: task.type,
          error: errorMessage,
          retries: task.retries,
          maxRetries: task.maxRetries,
        },
        'Task failed'
      );

      // Retry logic
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = TaskStatus.PENDING;
        this.processingQueue.push(task.id); // Add back to queue

        logger.info({ taskId: task.id, retries: task.retries }, 'Task queued for retry');
      } else {
        task.status = TaskStatus.FAILED;
        task.error = errorMessage;
        task.completedAt = new Date();

        logger.error(
          { taskId: task.id, type: task.type, error: errorMessage },
          'Task failed permanently'
        );
      }
    }
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } {
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case TaskStatus.PENDING:
          pending++;
          break;
        case TaskStatus.PROCESSING:
          processing++;
          break;
        case TaskStatus.COMPLETED:
          completed++;
          break;
        case TaskStatus.FAILED:
          failed++;
          break;
      }
    }

    return {
      pending,
      processing,
      completed,
      failed,
      total: this.tasks.size,
    };
  }

  /**
   * Clear completed tasks (cleanup)
   */
  public clearCompleted(): number {
    let cleared = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
        if (Date.now() - task.completedAt!.getTime() > 3600000) { // 1 hour
          this.tasks.delete(taskId);
          cleared++;
        }
      }
    }

    logger.debug({ cleared }, 'Completed tasks cleared');

    return cleared;
  }
}

/**
 * Global task queue instance
 */
let globalQueue: TaskQueue | null = null;

/**
 * Get or create global task queue
 */
export function getTaskQueue(): TaskQueue {
  if (!globalQueue) {
    globalQueue = new TaskQueue(2); // 2 concurrent workers
  }
  return globalQueue;
}

import OpenAI from 'openai';
import { getEncoding } from 'js-tiktoken';
import { logger, logError } from '../logger';
import { SocraticModality, SocraticPromptContext, SocraticResponse } from '../types/index';

/**
 * Token counter for cost estimation.
 * Use a known encoding (o200k_base) — chat model names like gpt-5.6 are not
 * in js-tiktoken's TiktokenModel union and are unrelated to counting.
 */
const tokenizer = getEncoding('o200k_base');

/**
 * Socratic system prompts for each modality
 * These define how the AI should respond
 */
const SOCRATIC_SYSTEM_PROMPTS: Record<SocraticModality, string> = {
  bias_blueprint: `You are "The Philosopher Socrates" an expert-level critical thinker and a rigorous 
  logic analyst and bias detector. Your goals is to guide the user to think more critically through a 
  back-and-forth conversation.
  
  Your role is to:
1. Identify hidden biases, unstated assumptions, and logical leaps in the user's argument
2. Ask penetrating questions that expose the weakest points in their reasoning
3. Be professional and constructive, not dismissive
4. Point out logical fallacies (ad hominem, straw man, appeal to authority, etc.)
5. Suggest how the user can strengthen their argument

Format your response as:
- HIDDEN ASSUMPTIONS: [List unstated premises]
- LOGICAL ISSUES: [Identify fallacies or weak reasoning]
- RECOMMENDATION: [Suggest how to strengthen the argument]
- EXPLORATION QUESTIONS: [Ask 3 questions that challenge their logic expecting them to answer one of the questions with more depth and clarity.]

Remember: ASK QUESTIONS, DON'T PROVIDE ANSWERS. Your goal is to help them think better and identify their own biases, not to win a debate.`,

  devil_advocate: `You are "The Philosopher Socrates" an expert-level critical thinker 
  and debate coach. Your fundamental goal is to improve the user's reasoning, 
  logical validity, and depth of insight. You tasked with stress-testing ideas through 
  rigorous counter-argument.

  Your role is to:
1. Guide the dialogue through a back-and-forth conversation by asking one question at a time
2. Generate the strongest possible opposing viewpoint to their argument
3. Identify what evidence contradicts their position
4. Highlight alternative explanations they may have missed
5. Remain respectful and intellectually honest, but do not be afraid to challenge them.
6. Force them to defend their position against legitimate criticism

Format your response as:
- USE THE SOCRATIC METHOD: [Use the Socratic Method to guide the dialogue and do not dump a long list of criticisms or counterarguments all at once.]
- AFTER EACH RESPONSE: [Ask one sharp, probing question that challenges an assumption, demands evidence, or highlights a potential blind spot.] 
- THE COUNTER-ARGUMENT: [Present the strongest opposing view]
- EVIDENCE AGAINST THEM: [What contradicts their position]
- ALTERNATIVE EXPLANATIONS: [What else could explain the facts]
- WHERE THEY'RE VULNERABLE: [Their weakest points]
- QUESTIONS THEY NEED TO ANSWER: [3-4 hardest questions about their position]

Remember: ASK QUESTIONS, DON'T PROVIDE ANSWERS. You're helping them build a more resilient idea, not tearing it down. And you are helping them think better, not to win a debate.`,

  socratic_auditor: `You are "The Philosopher Socrates" an expert-level critical thinker 
  and you are acting as a Socratic dialog facilitator. Your fundamental goal is to improve the user's reasoning, 
  logical validity, depth of insight, and critical thinking skills.
  
  Your role is to:
1. Ask profound, open-ended questions that force deep reflection
2. Challenge vague or unsupported claims with specific follow-ups
3. Guide them toward discovering their own contradictions or gaps
4. Build a logical chain of reasoning through carefully sequenced questions
5. Help them clarify what they actually believe vs. what they assume

Format your response as:
- INITIAL OBSERVATION: [What you noticed about their statement]
- CORE QUESTION: [One fundamental question about their core claim]
- FOLLOW-UP QUESTIONS: [3-4 sequential questions that build on their answer]
- WHAT WE'RE EXPLORING: [Why these questions matter]

Remember: Ask questions, don't provide answers. Let them discover the gaps themselves.`,

  source_scrutiny: `You are "The Philosopher Socrates" an expert-level critical thinker 
  and you are acting as a research quality auditor and evidence evaluator.
  
  Your role is to:
1. Evaluate the quality and credibility of sources they're relying on
2. Identify potential biases in their sources
3. Check for logical connections between evidence and conclusions
4. Spot cherry-picked data or missing contrary evidence
5. Suggest what additional evidence would strengthen their case

Format your response as:
- SOURCE EVALUATION: [Assess credibility, methodology, funding, potential bias]
- EVIDENCE QUALITY: [Is this sufficient to support their claim?]
- MISSING EVIDENCE: [What would really prove their point?]
- COUNTER-EVIDENCE: [What evidence contradicts their sources?]
- RECOMMENDATIONS: [What sources/evidence would strengthen their argument]

Remember: Your goal is to help them build an ironclad case, not undermine it.`,
};

/**
 * OpenAI service for handling LLM interactions
 */
export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(apiKey?: string, model: string = 'gpt-5.6', maxTokens: number = 2000) {
    const resolvedKey = apiKey || process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      throw new Error(
        'OpenAI API key missing. Set OPENAI_API_KEY in the server environment or provide a user key.'
      );
    }
    this.client = new OpenAI({
      apiKey: resolvedKey,
    });
    this.model = model || process.env.OPENAI_MODEL || 'gpt-5.6';
    this.maxTokens = maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
  }

  /**
   * Generate a Socratic response for the given context
   */
  async generateSocraticResponse(
    context: SocraticPromptContext
  ): Promise<SocraticResponse> {
    try {
      logger.debug(
        {
          modality: context.modality,
          userStatementLength: context.userStatement.length,
          hasDocument: !!context.documentContext,
        },
        'Generating Socratic response'
      );

      // Build messages array
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        ...((context.previousMessages || []) as any),
        {
          role: 'user',
          content: this.buildUserPrompt(context),
        },
      ];

      // Call OpenAI API
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SOCRATIC_SYSTEM_PROMPTS[context.modality],
          },
          ...messages,
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3,
      });

      const assistantResponse = response.choices[0]?.message?.content || '';

      // Extract reasoning if available (for o1 models)
      const reasoning = (response.choices[0] as any)?.message?.reasoning || '';

      // Calculate token usage
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;

      logger.debug(
        {
          modality: context.modality,
          promptTokens,
          completionTokens,
          totalTokens,
        },
        'Socratic response generated'
      );

      return {
        modality: context.modality,
        response: assistantResponse,
        reasoning,
        usageMetrics: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
      };
    } catch (error) {
      logError(error as Error, {
        action: 'generateSocraticResponse',
        modality: context.modality,
      });

      throw error;
    }
  }

  /**
   * Classify user intent to determine which Socratic modality to use
   * Returns the detected modality or a default
   */
  async classifyIntent(userStatement: string): Promise<SocraticModality> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert at understanding user intent. Classify the following user input into ONE of these categories:
- "bias_blueprint": When they want you to find hidden assumptions and logical flaws
- "devil_advocate": When they want counter-arguments and alternative views
- "socratic_auditor": When they want probing questions about their beliefs
- "source_scrutiny": When they want evidence evaluated or sources critiqued

Respond with ONLY the category name, no explanation.`,
          },
          {
            role: 'user',
            content: userStatement,
          },
        ],
        max_tokens: 50,
        temperature: 0.5,
      });

      const classification = (response.choices[0]?.message?.content || 'socratic_auditor')
        .toLowerCase()
        .trim() as SocraticModality;

      const validModalities: SocraticModality[] = [
        'bias_blueprint',
        'devil_advocate',
        'socratic_auditor',
        'source_scrutiny',
      ];

      return validModalities.includes(classification) ? classification : 'socratic_auditor';
    } catch (error) {
      logger.warn({ error }, 'Intent classification failed, defaulting to socratic_auditor');
      return 'socratic_auditor';
    }
  }

  /**
   * Count tokens in a string
   */
  countTokens(text: string): number {
    try {
      return tokenizer.encode(text).length;
    } catch (error) {
      logger.warn({ error }, 'Token counting failed, using estimate');
      return Math.ceil(text.length / 4); // Rough estimate
    }
  }

  /**
   * Estimate cost of API call (gpt-4o pricing)
   * As of Jan 2025: $5 per 1M input tokens, $15 per 1M output tokens
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    const INPUT_COST_PER_MILLION = 5;
    const OUTPUT_COST_PER_MILLION = 15;

    return (inputTokens / 1000000) * INPUT_COST_PER_MILLION +
           (outputTokens / 1000000) * OUTPUT_COST_PER_MILLION;
  }

  /**
   * Build user prompt with optional document context
   */
  private buildUserPrompt(context: SocraticPromptContext): string {
    let prompt = `User Statement:\n${context.userStatement}\n`;

    if (context.documentContext) {
      prompt += `\nDocument Context (first 2000 characters):\n${context.documentContext.substring(0, 2000)}\n`;
    }

    prompt += '\nProvide a thorough Socratic response:';

    return prompt;
  }

  /**
   * Stream a Socratic response (for real-time UI updates)
   * Returns an async iterable of response chunks
   */
  async *streamSocraticResponse(
    context: SocraticPromptContext
  ): AsyncGenerator<string> {
    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        ...((context.previousMessages || []) as any),
        {
          role: 'user',
          content: this.buildUserPrompt(context),
        },
      ];

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SOCRATIC_SYSTEM_PROMPTS[context.modality],
          },
          ...messages,
        ],
        max_tokens: this.maxTokens,
        temperature: 0.5,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logError(error as Error, {
        action: 'streamSocraticResponse',
        modality: context.modality,
      });
      throw error;
    }
  }

  /**
   * Validate API key by making a test call
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Say "OK" if you can hear me.',
          },
        ],
        max_tokens: 10,
      });

      return true;
    } catch (error) {
      logger.warn({ error }, 'API key validation failed');
      return false;
    }
  }
}

/**
 * Factory function to create OpenAI service with user's custom API key,
 * falling back to server OPENAI_API_KEY / OPENAI_MODEL from .env (all modalities).
 */
export function createOpenAIServiceForUser(
  userApiKey?: string | null,
  model?: string | null
): OpenAIService {
  return new OpenAIService(
    userApiKey || process.env.OPENAI_API_KEY,
    model || process.env.OPENAI_MODEL || 'gpt-5.6'
  );
}

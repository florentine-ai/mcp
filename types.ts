import { z } from "zod";

// Base schema for required inputs
const RequiredInputBase = z.object({
  keyPath: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({ $in: z.array(z.union([z.string(), z.number()])) })
  ])
});

// Input with database field
const RequiredInputWithDatabase = RequiredInputBase.extend({
  database: z.string(),
  collections: z.array(z.string()).optional()
});

// Input without database/collections
const RequiredInputWithoutCollections = RequiredInputBase.extend({
  database: z.undefined(),
  collections: z.undefined()
});

export const TRequiredInputSchema = z.union([
  RequiredInputWithDatabase,
  RequiredInputWithoutCollections
]);

export const TReturnTypesSchema = z.enum(["aggregation", "result", "answer"]);

// Zod schemas for function parameters and return values
export const AskManualInputSchema = z.object({
  question: z.string(),
  sessionId: z.string().optional(),
  returnTypes: z.array(z.enum(["aggregation", "result", "answer"])).optional(),
  requiredInputs: z.array(TRequiredInputSchema).optional()
});

export const AskAutoInputSchema = z.object({
  question: z.string()
});

// Base schemas for individual components
export const AggregationResponseSchema = z.object({
  confidence: z.number(),
  database: z.string(),
  collection: z.string(),
  aggregation: z.string() // EJSON.stringify output
});

export const ResultResponseSchema = z.object({
  result: z.any() // Since we don't know what type of data will be returned
});

export const AnswerResponseSchema = z.object({
  answer: z.string()
});

// Schema for complete API response (all possible fields optional)
export const AskResponseSchema = z
  .object({
    confidence: z.number().optional(),
    database: z.string().optional(),
    collection: z.string().optional(),
    aggregation: z.string().optional(),
    result: z.string().optional(),
    answer: z.string().optional()
  })
  .refine(
    (data) => {
      // Option 1: Aggregation (all four fields together or none)
      const hasAggregationFields =
        data.confidence !== undefined ||
        data.database !== undefined ||
        data.collection !== undefined ||
        data.aggregation !== undefined;
      const hasAllAggregationFields =
        data.confidence !== undefined &&
        data.database !== undefined &&
        data.collection !== undefined &&
        data.aggregation !== undefined;

      // Option 2: Result
      const hasResult = data.result !== undefined;

      // Option 3: Answer
      const hasAnswer = data.answer !== undefined;

      // Aggregation fields must all be present together or all missing
      if (hasAggregationFields && !hasAllAggregationFields) {
        return false;
      }

      // At least one of the three options must be present
      return hasAllAggregationFields || hasResult || hasAnswer;
    },
    {
      message:
        "At least one option must be present: (confidence + database + collection + aggregation), result, or answer. Aggregation fields must all be present together."
    }
  );

// Specific schemas for different returnType combinations
export const AggregationOnlyResponseSchema = AggregationResponseSchema;

export const ResultOnlyResponseSchema = ResultResponseSchema;

export const AnswerOnlyResponseSchema = AnswerResponseSchema;

export const AggregationAndResultResponseSchema =
  AggregationResponseSchema.merge(ResultResponseSchema);

export const AggregationAndAnswerResponseSchema =
  AggregationResponseSchema.merge(AnswerResponseSchema);

export const ResultAndAnswerResponseSchema =
  ResultResponseSchema.merge(AnswerResponseSchema);

export const FullResponseSchema =
  AggregationResponseSchema.merge(ResultResponseSchema).merge(
    AnswerResponseSchema
  );

export const TLLMServiceSchema = z.enum([
  "openai",
  "deepseek",
  "google",
  "anthropic"
]);

export const FlorentineConfigSchema = z
  .object({
    llmService: TLLMServiceSchema.optional(),
    llmKey: z.string().optional(),
    sessionId: z.string().optional(),
    requiredInputs: z.array(TRequiredInputSchema).optional(),
    returnTypes: z.array(z.string())
  })
  .refine(
    (data) => {
      const hasLlmService = data.llmService !== undefined;
      const hasLlmKey = data.llmKey !== undefined;
      return (hasLlmService && hasLlmKey) || (!hasLlmService && !hasLlmKey);
    },
    {
      message: "llmService and llmKey must both be present or both be absent"
    }
  );

export const FlorentineRequestBodySchema = z.object({
  question: z.string(),
  config: FlorentineConfigSchema
});

export const TMongoInstanceTypeSchema = z.enum(["atlas", "self-deployed"]);

export const ICollectionStructureDynamicSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    keyPath: z.string().optional(),
    typeOfValues: z.string().optional(),
    children: z.array(ICollectionStructureDynamicSchema).optional()
  })
);

export const IUserCollectionStructureSchema = z.object({
  collectionName: z.string(),
  summary: z.string(),
  mappings: z
    .array(
      z.object({
        keyPath: z.string(),
        collectionName: z.string()
      })
    )
    .optional(),
  structure: z.array(ICollectionStructureDynamicSchema)
});

export const ICollectionSummarySchema = z.object({
  dbName: z.string(),
  instanceType: TMongoInstanceTypeSchema,
  collections: z.array(IUserCollectionStructureSchema)
});

export const ListCollectionsResponseSchema = z.object({
  summaries: z.array(ICollectionSummarySchema)
});

export const HeadersSchema = z.object({
  "Content-Type": z.string(),
  "florentine-token": z.string()
});

// Zod schema for MCP server configuration
export const McpServerConfigSchema = z.object({
  name: z.string(),
  version: z.string()
});

// Zod schema for tool response content
export const ToolContentSchema = z.object({
  type: z.literal("text"),
  text: z.string()
});

export const ToolResponseSchema = z.object({
  content: z.array(ToolContentSchema),
  isError: z.boolean().optional()
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    name: z.string(),
    statusCode: z.number(),
    message: z.string(),
    errorCode: z.string(),
    requestId: z.string()
  })
});

// Type exports for better developer experience
export type TApiResponse = z.infer<typeof AskResponseSchema>;
export type TAggregationResponse = z.infer<typeof AggregationResponseSchema>;
export type TResultResponse = z.infer<typeof ResultResponseSchema>;
export type TAnswerResponse = z.infer<typeof AnswerResponseSchema>;
export type TLLMService = z.infer<typeof TLLMServiceSchema>;
export type TRequiredInput = z.infer<typeof TRequiredInputSchema>;
export type TReturnTypes = z.infer<typeof TReturnTypesSchema>;
export type TAskInput = z.infer<typeof AskManualInputSchema>;
export type TAskResponse = z.infer<typeof AskResponseSchema>;
export type TFlorentineConfig = z.infer<typeof FlorentineConfigSchema>;
export type TFlorentineRequestBody = z.infer<
  typeof FlorentineRequestBodySchema
>;
export type TListCollectionsResponse = z.infer<
  typeof ListCollectionsResponseSchema
>;
export type THeaders = z.infer<typeof HeadersSchema>;
export type TMcpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type TToolContent = z.infer<typeof ToolContentSchema>;
export type TToolResponse = z.infer<typeof ToolResponseSchema>;
export type TErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type TMongoInstanceType = z.infer<typeof TMongoInstanceTypeSchema>;
export type ICollectionStructureDynamic = z.infer<
  typeof ICollectionStructureDynamicSchema
>;
export type IUserCollectionStructure = z.infer<
  typeof IUserCollectionStructureSchema
>;
export type ICollectionSummary = z.infer<typeof ICollectionSummarySchema>;

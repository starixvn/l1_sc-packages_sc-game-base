import { trace } from "@opentelemetry/api";

export const instrumentation = trace.getTracer("sc-games");

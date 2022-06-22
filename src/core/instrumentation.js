import { trace } from "@opentelemetry/api";

export const instrumentation = opentelemetry.trace.getTracer("sc-games");

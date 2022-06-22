import { trace, SpanKind } from "@opentelemetry/api";
import { SemanticAttributes, MessagingOperationValues, MessagingDestinationKindValues } from "@opentelemetry/semantic-conventions";

export const startInstrument = (action) => {
    const instrumentation = trace.getTracer("sc-games");

    return instrumentation.startSpan(`${action} ${MessagingOperationValues.RECEIVE}`, {
        kind: SpanKind.CONSUMER,
        attributes: {
            [SemanticAttributes.MESSAGING_SYSTEM]: "socket.io",
            [SemanticAttributes.MESSAGING_OPERATION]: MessagingOperationValues.RECEIVE,
        },
    });
};

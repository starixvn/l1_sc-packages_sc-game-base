import { context, trace, SpanKind } from "@opentelemetry/api";
import { SemanticAttributes, MessagingOperationValues } from "@opentelemetry/semantic-conventions";

export const tracer = trace.getTracer("sc-instrument", "1.0.0");

export const spanOptions = {
    kind: SpanKind.CONSUMER,
    attributes: {
        [SemanticAttributes.MESSAGING_SYSTEM]: "socket.io",
        [SemanticAttributes.MESSAGING_OPERATION]: MessagingOperationValues.RECEIVE,
    },
};

export const startInstrument = (action) => {
    const span = tracer.startSpan(`${action} ${MessagingOperationValues.RECEIVE}`, {
        kind: SpanKind.CONSUMER,
        attributes: {
            [SemanticAttributes.MESSAGING_SYSTEM]: "socket.io",
            [SemanticAttributes.MESSAGING_OPERATION]: MessagingOperationValues.RECEIVE,
        },
    });

    context.with(trace.setSpan(context.active(), span), () => {});

    return span;
};

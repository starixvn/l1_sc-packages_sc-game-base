import { context, trace, SpanKind } from "@opentelemetry/api";
import { SemanticAttributes, MessagingOperationValues } from "@opentelemetry/semantic-conventions";

export const startInstrument = (action) => {
    const instrumentation = trace.getTracer("sc-instrument", "1.0.0");

    const span = instrumentation.startSpan(`${action} ${MessagingOperationValues.RECEIVE}`, {
        kind: SpanKind.CONSUMER,
        attributes: {
            [SemanticAttributes.MESSAGING_SYSTEM]: "socket.io",
            [SemanticAttributes.MESSAGING_OPERATION]: MessagingOperationValues.RECEIVE,
        },
    });

    trace.setSpan(context.active(), span);

    return span;
};

import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { JaegerPropagator } from "@opentelemetry/propagator-jaeger";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from "@opentelemetry/core";
import { B3InjectEncoding, B3Propagator } from "@opentelemetry/propagator-b3";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { MongooseInstrumentation } from "opentelemetry-instrumentation-mongoose";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { SocketIoInstrumentation } from "opentelemetry-instrumentation-socket.io";

const trace = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "MiniSedie Service",
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: "LOCAL",
    }),
    spanProcessor: new BatchSpanProcessor(
        new JaegerExporter({
            tags: [],
            endpoint: "http://10.10.50.69:14268/api/traces",
        })
    ),
    contextManager: new AsyncLocalStorageContextManager(),
    textMapPropagator: new CompositePropagator({
        propagators: [
            new JaegerPropagator(),
            new W3CTraceContextPropagator(),
            new W3CBaggagePropagator(),
            new B3Propagator({
                injectEncoding: B3InjectEncoding.MULTI_HEADER,
            }),
        ],
    }),
    instrumentations: [
        new HttpInstrumentation({
            ignoreIncomingRequestHook: (req) => {
                return req.method === "GET";
            },
        }),
        new ExpressInstrumentation(),
        new SocketIoInstrumentation(),
        new MongooseInstrumentation(),
    ],
});

process.on("SIGTERM", () => {
    trace
        .shutdown()
        .then(
            () => console.log("SDK shut down successfully"),
            (err) => console.log("Error shutting down SDK", err)
        )
        .finally(() => process.exit(0));
});

export default trace;

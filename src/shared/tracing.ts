import { config } from '../config';

/**
 * Initializes OpenTelemetry tracing. Call this ONCE at the very top of a
 * service entrypoint (before other imports do their work) so auto-instrumentation
 * can patch http/express/pg/amqplib.
 *
 * Tracing is opt-in via OTEL_ENABLED so the app runs with zero extra setup by
 * default. When enabled, spans are exported to an OTLP collector.
 */
export function startTracing(serviceName: string): void {
  if (!config.OTEL_ENABLED) return;

  // Imported lazily so the dependency graph stays light when tracing is off.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resource } = require('@opentelemetry/resources');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}

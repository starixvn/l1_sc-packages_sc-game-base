/**
 * Event Interceptor Mixin
 * Provides reusable interceptor functionality for any event consumer
 * Follows the established game base architecture patterns
 */
export default function EventInterceptorMixin(Base) {
    return class extends Base {
        /**
         * Initialize interceptor system
         * @param {Array} interceptors - Array of interceptors for this consumer
         * @param {string} eventType - Type of events this consumer handles (e.g., 'bet', 'settlement', 'round')
         */
        initializeInterceptors(interceptors = [], eventType = "generic") {
            this.eventInterceptors = Array.isArray(interceptors) ? interceptors : [];
            this.eventType = eventType;
        }

        /**
         * Get interceptors that should process the given event
         * @param {Object} context - Event context
         * @returns {Array} Applicable interceptors
         */
        getApplicableInterceptors(context) {
            return this.eventInterceptors.filter((interceptor) => interceptor.shouldIntercept(context));
        }

        /**
         * Execute an interceptor event for all applicable interceptors
         * @param {string} eventName - Name of the event to execute
         * @param {Array} interceptors - Interceptors to execute
         * @param {Object} context - Context to pass to interceptors
         * @returns {Promise<Object>} Combined result
         */
        async executeInterceptorEvent(eventName, interceptors, context) {
            if (!Array.isArray(interceptors) || interceptors.length === 0) {
                return { success: true };
            }

            for (const interceptor of interceptors) {
                if (typeof interceptor[eventName] === "function") {
                    const result = await interceptor[eventName](context);
                    if (result && result.success === false) {
                        this.logService?.logWarning(
                            `Interceptor ${interceptor.name} event ${eventName} failed for ${this.eventType}`,
                            result
                        );
                        return { success: false, interceptor: interceptor.name, ...result };
                    }
                }
            }
            return { success: true };
        }

        /**
         * Execute interceptor transformations that modify data
         * @param {string} transformName - Name of the transformation to execute
         * @param {Array} interceptors - Interceptors to execute
         * @param {Object} context - Context to pass to interceptors
         * @returns {Object} Transformed data
         */
        executeInterceptorTransform(transformName, interceptors, context) {
            if (!Array.isArray(interceptors) || interceptors.length === 0) {
                return Object.values(context)[0];
            }

            let result = Object.values(context)[0];

            for (const interceptor of interceptors) {
                if (typeof interceptor.transformEventData === "function") {
                    result = interceptor.transformEventData(transformName, {
                        ...context,
                        [Object.keys(context)[0]]: result,
                    });
                }
            }

            return result;
        }

        /**
         * Execute the complete interceptor workflow for an event
         * @param {string} eventPhase - 'before', 'after-success', 'after-failure'
         * @param {Object} context - Event context
         * @param {Array} transforms - Optional transforms to apply
         * @returns {Promise<Object>} Result with success status and transformed data
         */
        async executeInterceptorWorkflow(eventPhase, context, transforms = []) {
            const applicableInterceptors = this.getApplicableInterceptors(context);

            // Execute the appropriate event
            let eventName;
            switch (eventPhase) {
                case "before":
                    eventName = "beforeEvent";
                    break;
                case "after-success":
                    eventName = "afterSuccessEvent";
                    break;
                case "after-failure":
                    eventName = "afterFailureEvent";
                    break;
                default:
                    throw new Error(`Invalid event phase: ${eventPhase}`);
            }

            const eventResult = await this.executeInterceptorEvent(eventName, applicableInterceptors, context);

            if (!eventResult.success) {
                return eventResult;
            }

            // Apply transforms if provided
            const transformedData = {};
            for (const transform of transforms) {
                transformedData[transform.key] = this.executeInterceptorTransform(
                    transform.name,
                    applicableInterceptors,
                    transform.context
                );
            }

            return {
                success: true,
                transformedData: Object.keys(transformedData).length > 0 ? transformedData : undefined,
            };
        }
    };
}

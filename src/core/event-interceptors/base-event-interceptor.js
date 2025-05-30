/**
 * Base abstract class for event interceptors
 * Follows the established game base architecture patterns
 * Similar to EventConsumers but for cross-cutting concerns
 */
export default class BaseEventInterceptor {
    /**
     * @param {Object} dependencies - Interceptor dependencies
     * @param {Object} dependencies.logService - Logging service
     * @param {Object} dependencies.definition - Game definition
     */
    constructor({ logService, definition }) {
        this.logService = logService;
        this.definition = definition;
    }

    /**
     * Get the name of this interceptor
     * @returns {string} Interceptor name
     */
    get name() {
        return this.constructor.name;
    }

    /**
     * Determine if this interceptor should process the given context
     * @param {Object} context - Event context
     * @returns {boolean} Whether this interceptor should process
     */
    shouldIntercept(context) {
        return true; // Override in subclasses
    }

    /**
     * Process before event execution
     * @param {Object} context - Event context
     * @returns {Promise<Object>} Result with success status and optional data
     */
    async beforeEvent(context) {
        return { success: true };
    }

    /**
     * Process after successful event execution
     * @param {Object} context - Event context with results
     * @returns {Promise<void>}
     */
    async afterSuccessEvent(context) {
        // Override in subclasses if needed
    }

    /**
     * Process after failed event execution
     * @param {Object} context - Event context with error
     * @returns {Promise<void>}
     */
    async afterFailureEvent(context) {
        // Override in subclasses if needed
    }

    /**
     * Transform/enhance event data
     * @param {string} transformName - Name of the transformation
     * @param {Object} context - Event context
     * @returns {Object} Transformed data
     */
    transformEventData(transformName, context) {
        // Default implementation returns the first context value
        return Object.values(context)[0];
    }
}

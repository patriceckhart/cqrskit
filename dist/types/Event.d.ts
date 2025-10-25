/**
 * Raw event structure as stored in the event store
 */
export interface RawEvent {
    /** Unique event identifier */
    id: string;
    /** Event type identifier */
    type: string;
    /** Source/origin of the event */
    source: string;
    /** Subject/aggregate this event belongs to */
    subject: string;
    /** Event timestamp */
    time: string;
    /** Event data payload */
    data: Record<string, any>;
    /** Optional metadata */
    metadata?: Record<string, any>;
}
/**
 * Precondition for conditional event publishing
 */
export interface Precondition {
    /** Precondition type */
    type: string;
    /** Precondition payload */
    payload: Record<string, any>;
}
/**
 * Event to be published
 */
export interface EventToPublish {
    /** Source identifier */
    source: string;
    /** Subject/aggregate path */
    subject: string;
    /** Event type */
    type: string;
    /** Event data */
    data: Record<string, any>;
    /** Optional metadata */
    metadata?: Record<string, any>;
    /** Optional preconditions */
    preconditions?: Precondition[];
}

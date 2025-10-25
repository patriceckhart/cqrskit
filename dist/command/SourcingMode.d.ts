/**
 * Determines the scope of event fetching for state rebuilding
 */
export declare enum SourcingMode {
    /** No event sourcing - command handler receives no prior state */
    NONE = "NONE",
    /** Source events for the exact subject only */
    LOCAL = "LOCAL",
    /** Source events for subject and all child subjects (hierarchical) */
    RECURSIVE = "RECURSIVE"
}

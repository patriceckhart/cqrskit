"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcingMode = void 0;
/**
 * Determines the scope of event fetching for state rebuilding
 */
var SourcingMode;
(function (SourcingMode) {
    /** No event sourcing - command handler receives no prior state */
    SourcingMode["NONE"] = "NONE";
    /** Source events for the exact subject only */
    SourcingMode["LOCAL"] = "LOCAL";
    /** Source events for subject and all child subjects (hierarchical) */
    SourcingMode["RECURSIVE"] = "RECURSIVE";
})(SourcingMode || (exports.SourcingMode = SourcingMode = {}));

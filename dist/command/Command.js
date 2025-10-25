"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectCondition = void 0;
/**
 * Subject condition for validating aggregate state before command execution
 */
var SubjectCondition;
(function (SubjectCondition) {
    /** No condition check required */
    SubjectCondition["NONE"] = "NONE";
    /** Subject must not exist (for creation commands) */
    SubjectCondition["NEW"] = "NEW";
    /** Subject must already exist (for update/delete commands) */
    SubjectCondition["EXISTS"] = "EXISTS";
})(SubjectCondition || (exports.SubjectCondition = SubjectCondition = {}));

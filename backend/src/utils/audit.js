import { AuditLog } from "../models/index.js";

export function writeAudit(user, action, target = "", session = undefined) {
  return AuditLog.create([{
    actor: user.id,
    actorName: user.name,
    role: user.role,
    action,
    target
  }], session ? { session } : {});
}

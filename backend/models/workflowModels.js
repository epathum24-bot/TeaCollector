import User from "./User.js";
import Company from "./Company.js";
import Lorry from "./Lorry.js";
import CollectionRequest from "./CollectionRequest.js";
import RequestSequence from "./RequestSequence.js";
import Notification from "./Notification.js";
import MonthlySettlement from "./MonthlySettlement.js";

export function createModels() {
  return {
    users: User,
    companies: Company,
    lorries: Lorry,
    requests: CollectionRequest,
    requestSequences: RequestSequence,
    notifications: Notification,
    settlements: MonthlySettlement,
  };
}

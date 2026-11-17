import { fieldOf, nestedFieldOf, unwrap } from "../format.js";
import { docAssignee, docStatus, isDoneStatus, type TrackerDoc } from "./tracker.js";

export interface Identity {
  name?: string;
  username?: string;
  email?: string;
  id?: string;
}

const NAME_FIELDS = ["fullName", "full_name", "name", "displayName", "display_name"];
const ID_FIELDS = ["id", "accountId", "account_id", "userId", "user_id", "employeeId"];

function pickString(source: unknown, fields: string[]): string | undefined {
  const value = fieldOf(source, fields);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function extractIdentity(me: unknown): Identity {
  const body = unwrap<Record<string, unknown>>(me);
  const root =
    body && typeof body === "object" ? (body as Record<string, unknown>) : ({} as Record<string, unknown>);
  const account = (
    root.account ??
    root.user ??
    root.profile ??
    root.me ??
    root
  ) as Record<string, unknown>;

  return {
    name: pickString(account, NAME_FIELDS) ?? pickString(root, NAME_FIELDS),
    username: pickString(account, ["username", "userName"]) ?? pickString(root, ["username"]),
    email: pickString(account, ["email", "emailAddress"]) ?? pickString(root, ["email"]),
    id: pickString(account, ID_FIELDS) ?? pickString(root, ID_FIELDS),
  };
}

function assigneeIds(doc: TrackerDoc): string[] {
  const value = nestedFieldOf(doc, ["assignee", "assignees", "members", "pic"]);
  const collect = (item: unknown): string[] => {
    if (Array.isArray(item)) return item.flatMap(collect);
    if (item && typeof item === "object") {
      const id = fieldOf(item, ID_FIELDS);
      return typeof id === "string" ? [id] : [];
    }
    return [];
  };
  const direct = fieldOf(doc, ID_FIELDS);
  return [...collect(value), ...(typeof direct === "string" ? [direct] : [])];
}

export interface MyTaskFilters {
  status?: string;
  includeDone?: boolean;
  overdueOnly?: boolean;
  limit?: number;
  now?: Date;
}

export function filterMyTasks(
  docs: TrackerDoc[],
  identity: Identity,
  filters: MyTaskFilters = {},
): TrackerDoc[] {
  const needles = [identity.name, identity.username, identity.email]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const status = filters.status?.trim().toLowerCase();
  const includeDone = filters.includeDone ?? true;
  const limit = filters.limit ?? 50;

  return docs
    .filter((doc) => {
      const assigneeText = docAssignee(doc).toLowerCase();
      const byText = needles.some((needle) => assigneeText.includes(needle));
      const byId = identity.id ? assigneeIds(doc).includes(identity.id) : false;
      if (!byText && !byId) return false;
      if (!includeDone && isDoneStatus(docStatus(doc))) return false;
      if (status && !docStatus(doc).toLowerCase().includes(status)) return false;
      return true;
    })
    .slice(0, limit);
}

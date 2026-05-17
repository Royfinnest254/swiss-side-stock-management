import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("super_admin"), v.literal("staff")),
    displayName: v.optional(v.string()),
    token: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    failedAttempts: v.optional(v.number()),
    lockUntil: v.optional(v.number()),
    otpCode: v.optional(v.string()),
    otpExpiry: v.optional(v.number()),
    resetToken: v.optional(v.string()),
    resetTokenExpiry: v.optional(v.number()),
    lastResetRequest: v.optional(v.number()),
  })
  .index("by_email", ["email"])
  .index("by_token", ["token"])
  .index("by_role", ["role"]),
  
  items: defineTable({
    name: v.string(),
    unit: v.string(),
    quantity: v.number(),
    reorderLevel: v.number(),
    isTest: v.optional(v.boolean()),
  })
  .index("by_name", ["name"])
  .searchIndex("search_name", { searchField: "name" }),

  gymItems: defineTable({
    name: v.string(),
    condition: v.union(v.literal("Excellent"), v.literal("Good"), v.literal("Maintenance"), v.literal("Broken")),
    quantity: v.number(),
    lastChecked: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
  .index("by_name", ["name"])
  .searchIndex("search_name", { searchField: "name" }),

  rooms: defineTable({
    name: v.string(),
    type: v.string(),
    status: v.union(v.literal("Ready"), v.literal("Occupied"), v.literal("Cleaning"), v.literal("Maintenance")),
    notes: v.optional(v.string()),
    needs: v.optional(v.string()),
  })
  .index("by_name", ["name"])
  .searchIndex("search_name", { searchField: "name" }),

  roomItems: defineTable({
    roomId: v.id("rooms"),
    itemName: v.string(),
    condition: v.union(v.literal("Excellent"), v.literal("Good"), v.literal("Maintenance"), v.literal("Broken")),
    quantity: v.number(),
    notes: v.optional(v.string()),
  })
  .index("by_roomId", ["roomId"])
  .index("by_itemName", ["itemName"]),

  transactions: defineTable({
    itemId: v.union(v.id("items"), v.id("generalSupplies")),
    itemName: v.string(),
    type: v.union(v.literal("RESTOCK"), v.literal("WITHDRAWAL")),
    quantity: v.number(),
    unit: v.string(),
    person: v.string(),
    notes: v.optional(v.string()),
  })
  .index("by_itemId", ["itemId"])
  .index("by_type", ["type"]),

  adminLogs: defineTable({
    adminEmail: v.string(),
    action: v.string(),
    targetEmail: v.string(),
    details: v.optional(v.string()),
  }),

  // Proactive Error Monitoring Table
  systemErrors: defineTable({
    userEmail: v.optional(v.string()),
    message: v.string(),
    stack: v.optional(v.string()),
    url: v.string(),
    timestamp: v.number(),
  }),

  needs: defineTable({
    department: v.union(v.literal("Kitchen"), v.literal("Gym"), v.literal("Rooms"), v.literal("General")),
    roomId: v.optional(v.id("rooms")),
    item: v.string(),
    quantity: v.optional(v.string()),
    status: v.union(v.literal("Pending"), v.literal("Ordered"), v.literal("Fulfilled")),
    priority: v.union(v.literal("Low"), v.literal("Medium"), v.literal("High")),
    notes: v.optional(v.string()),
    requestor: v.string(),
  })
  .index("by_department", ["department"])
  .index("by_roomId", ["roomId"]),

  generalSupplies: defineTable({
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    reorderLevel: v.number(),
    category: v.union(v.literal("Cleaning"), v.literal("Toiletries"), v.literal("Office"), v.literal("Other")),
    notes: v.optional(v.string()),
  })
  .searchIndex("search_name", { searchField: "name" }),
});

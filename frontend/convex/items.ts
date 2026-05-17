import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkAuth } from "./auth";

export const getAll = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await checkAuth(ctx, args.token);
    return await ctx.db.query("items").collect();
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    unit: v.string(),
    quantity: v.number(),
    reorderLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const { token, ...data } = args;
    await checkAuth(ctx, token, "super_admin");
    return await ctx.db.insert("items", data);
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("items"),
    name: v.string(),
    unit: v.string(),
    quantity: v.number(),
    reorderLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const { token, id, ...rest } = args;
    await checkAuth(ctx, token, "staff");
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { 
    token: v.string(),
    id: v.id("items") 
  },
  handler: async (ctx, args) => {
    await checkAuth(ctx, args.token, "super_admin");
    await ctx.db.delete(args.id);
  },
});

export const countItems = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("items").collect();
    return items.length;
  },
});

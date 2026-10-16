import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  authenticate,
  role,
  hashPassword,
  checkPassword,
  publicUser,
  signToken,
} from "../utils/auth.js";
import {
  text,
  email,
  areas,
  scaled,
  collectionDate,
  calculateBill,
  today,
  assertTransition,
  fail,
} from "../utils/validation.js";
const now = () => new Date().toISOString();
const entity = (data) => ({ id: randomUUID(), createdAt: now(), ...data });
const optional = (value, label, max = 500) =>
  text(value ?? "", label, { min: 0, max });
const requireCompany = (record, user) => {
  if (!record || record.companyId !== user.companyId)
    fail("Record not found.", 404);
  return record;
};
const notify = async (store, recipientId, type, title, message, request) =>
  store.create("notifications", {
    id: randomUUID(),
    recipientId,
    type,
    title,
    message,
    requestId: request?.id,
    requestNumber: request?.requestNumber,
    read: false,
    createdAt: now(),
  });
const notifyCompanyUsers = async (store, companyId, type, title, message, request) => {
  const users = await store.list("users", { companyId, role: "company" });
  await Promise.all(users.map((user) => notify(store, user.id, type, title, message, request)));
};
const pickupDetails = (request) =>
  [
    `Seller: ${request.ownerName} (${request.ownerPhone})`,
    `Date: ${request.date} · ${request.timeWindow}`,
    `Area: ${request.area}`,
    `Pickup location: ${request.location}`,
    `Estimated weight: ${request.estimatedGrams / 1000} kg`,
    request.notes ? `Notes: ${request.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
const settlementMonth = (value) => {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    fail("Choose a valid settlement month.");
  return value;
};
export function routes(store, secret) {
  const api = Router();
  api.get("/health", (req, res) => res.json({ ok: true, mode: store.mode }));
  api.get("/config", (req, res) =>
    res.json({
      mode: store.mode,
      currency: "LKR",
      today: today(),
    }),
  );

  // Small in-process rate limit suitable for a single local development server.
  const attempts = new Map();
  api.use("/auth", (req, res, next) => {
    if (req.method !== "POST") return next();
    const time = Date.now();
    for (const [key, entry] of attempts)
      if (entry.until < time) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: time + 15 * 60000 };
    entry.count++;
    attempts.set(key, entry);
    if (entry.count > 50)
      return res
        .status(429)
        .json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
    next();
  });
  api.post("/auth/register", async (req, res) => {
    const b = req.body;
    if (!["owner", "company"].includes(b.role))
      fail(
        "Choose estate owner or company. Collectors are created by their company.",
      );
    const address = optional(b.address, "Address", 300);
    const user = entity({
      name: text(b.name, "Name", { max: 100 }),
      email: email(b.email),
      phone: text(b.phone, "Phone", { max: 30 }),
      address,
      role: b.role,
      active: true,
      passwordHash: await hashPassword(b.password),
    });
    if (await store.one("users", { email: user.email }))
      fail("An account with this email already exists.", 409);
    let company;
    if (b.role === "company") {
      company = entity({
        name: text(b.companyName, "Company name", { max: 100 }),
        phone: user.phone,
        address,
        areas: areas(b.areas),
        rateCents: scaled(b.rate, "Current buying price", 2, 100000),
      });
      user.companyId = company.id;
      await store.create("companies", company);
    }
    try {
      await store.create("users", user);
    } catch (error) {
      if (company) await store.remove("companies", company.id);
      throw error;
    }
    res
      .status(201)
      .json({ user: publicUser(user), token: signToken(user, secret) });
  });
  api.post("/auth/login", async (req, res) => {
    const user = await store.one("users", { email: email(req.body.email) });
    if (
      !user?.active ||
      !(await checkPassword(req.body.password, user.passwordHash))
    )
      fail("Email or password is incorrect.", 401);
    res.json({ user: publicUser(user), token: signToken(user, secret) });
  });
  api.use(authenticate(store, secret));
  api.get("/auth/me", (req, res) => res.json({ user: publicUser(req.user) }));
  api.get("/state", async (req, res) => {
    const u = req.user;
    let lorries,
      companies,
      requests,
      collectors = [];
    if (u.role === "owner") {
      lorries = await store.list("lorries", { active: true });
      companies = await store.list("companies");
      requests = await store.list("requests", { ownerId: u.id });
    } else if (u.role === "company") {
      lorries = await store.list("lorries", { companyId: u.companyId });
      companies = await store.list("companies", { id: u.companyId });
      requests = await store.list("requests", { companyId: u.companyId });
      collectors = (
        await store.list("users", { companyId: u.companyId, role: "collector" })
      ).map(publicUser);
    } else {
      lorries = await store.list("lorries", {
        companyId: u.companyId,
        driverId: u.id,
      });
      companies = await store.list("companies", { id: u.companyId });
      const ids = new Set(lorries.map((x) => x.id));
      requests = (
        await store.list("requests", { companyId: u.companyId })
      ).filter((x) => ids.has(x.lorryId));
    }
    const trucks = [];
    for (const lorry of lorries) {
      const driver = await store.one("users", { id: lorry.driverId });
      trucks.push({ ...lorry, driverName: driver?.name || "Unavailable" });
    }
    requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const notifications = (await store.list("notifications", { recipientId: u.id }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const settlements = await store.list(
      "settlements",
      u.role === "company" ? { companyId: u.companyId } : { ownerId: u.id },
    );
    settlements.sort((a, b) => b.month.localeCompare(a.month));
    res.json({
      user: publicUser(u),
      companies,
      lorries: trucks,
      requests,
      collectors,
      today: today(),
      notifications,
      settlements,
    });
  });
  api.patch("/profile", async (req, res) => {
    const patch = {
      name: text(req.body.name, "Name", { max: 100 }),
      phone: text(req.body.phone, "Phone", { max: 30 }),
      address: optional(req.body.address, "Address", 300),
    };
    res.json({
      user: publicUser(await store.update("users", req.user.id, patch)),
    });
  });
  api.patch("/company", role("company"), async (req, res) => {
    const patch = {
      name: text(req.body.name, "Company name", { max: 100 }),
      phone: text(req.body.phone, "Phone", { max: 30 }),
      address: optional(req.body.address, "Address", 300),
      areas: areas(req.body.areas),
      rateCents: scaled(req.body.rate, "Rate per kg", 2, 100000),
    };
    res.json(await store.update("companies", req.user.companyId, patch));
  });
  api.post("/collectors", role("company"), async (req, res) => {
    const user = entity({
      name: text(req.body.name, "Collector name", { max: 100 }),
      email: email(req.body.email),
      phone: text(req.body.phone, "Phone", { max: 30 }),
      passwordHash: await hashPassword(req.body.password),
      role: "collector",
      companyId: req.user.companyId,
      active: true,
      address: "",
    });
    if (await store.one("users", { email: user.email }))
      fail("This email is already registered.", 409);
    res.status(201).json(publicUser(await store.create("users", user)));
  });
  async function lorryInput(b, u, existingId) {
    const driver = await store.one("users", {
      id: typeof b.driverId === "string" ? b.driverId : "",
    });
    if (
      !driver ||
      driver.role !== "collector" ||
      !driver.active ||
      driver.companyId !== u.companyId
    )
      fail("Choose a collector from your company.");
    const number = text(b.vehicleNumber, "Vehicle number", {
      max: 30,
    }).toUpperCase();
    const existing = await store.one("lorries", { vehicleNumber: number });
    if (existing && existing.id !== existingId)
      fail("This vehicle number is already registered.", 409);
    const capacityGrams = scaled(b.capacity, "Capacity", 3, 20000);
    if (capacityGrams <= 0) fail("Capacity must be greater than zero.");
    if (typeof b.active !== "boolean") fail("Active must be true or false.");
    if (existingId) {
      const byDay = {};
      for (const r of await store.list("requests", { lorryId: existingId })) {
        if (
          !["cancelled", "rejected"].includes(r.status) &&
          r.date >= today()
        )
          byDay[r.date] = (byDay[r.date] || 0) + r.estimatedGrams;
      }
      if (Object.values(byDay).some((n) => n > capacityGrams))
        fail("Capacity is below the quantity already booked.");
    }
    return {
      label: text(b.label, "Lorry label", { max: 100 }),
      vehicleNumber: number,
      capacityGrams,
      areas: areas(b.areas),
      driverId: driver.id,
      active: b.active,
    };
  }
  api.post("/lorries", role("company"), async (req, res) => {
    const data = await lorryInput(req.body, req.user);
    res
      .status(201)
      .json(
        await store.create(
          "lorries",
          entity({ ...data, companyId: req.user.companyId }),
        ),
      );
  });
  api.patch("/lorries/:id", role("company"), async (req, res) => {
    requireCompany(await store.one("lorries", { id: req.params.id }), req.user);
    res.json(
      await store.update(
        "lorries",
        req.params.id,
        await lorryInput(req.body, req.user, req.params.id),
      ),
    );
  });
  api.delete("/lorries/:id", role("company"), async (req, res) => {
    requireCompany(await store.one("lorries", { id: req.params.id }), req.user);
    if ((await store.list("requests", { lorryId: req.params.id })).length)
      fail(
        "This lorry has collection history. Edit it and turn off new bookings instead.",
      );
    await store.remove("lorries", req.params.id);
    res.json({ ok: true });
  });
  async function requestInput(b, lorry, ignoreId) {
    if (!lorry?.active) fail("This lorry is not available for new bookings.");
    const date = collectionDate(b.date);
    const estimatedGrams = scaled(
      b.estimatedWeight,
      "Estimated weight",
      3,
      20000,
    );
    if (estimatedGrams <= 0)
      fail("Estimated weight must be greater than zero.");
    const existing = await store.list("requests", { lorryId: lorry.id, date });
    const used = existing
      .filter(
        (r) =>
          r.id !== ignoreId &&
          !["cancelled", "rejected"].includes(r.status),
      )
      .reduce((sum, r) => sum + r.estimatedGrams, 0);
    if (used + estimatedGrams > lorry.capacityGrams)
      fail(
        `Only ${Math.max(0, lorry.capacityGrams - used) / 1000} kg of estimated capacity remains for this date.`,
      );
    const area = text(b.area, "Collection area", { max: 50 });
    if (!lorry.areas.some((x) => x.toLowerCase() === area.toLowerCase()))
      fail("Choose an area served by this lorry.");
    if (!["Morning", "Afternoon", "Any time"].includes(b.timeWindow))
      fail("Choose a collection time window.");
    return {
      date,
      estimatedGrams,
      area,
      timeWindow: b.timeWindow,
      location: text(b.location, "Pickup address / directions", {
        min: 5,
        max: 500,
      }),
      notes: optional(b.notes, "Notes"),
      updatedAt: now(),
    };
  }
  api.post("/requests", role("owner"), async (req, res) => {
    const lorry = await store.one("lorries", {
      id: typeof req.body.lorryId === "string" ? req.body.lorryId : "",
    });
    const input = await requestInput(req.body, lorry);
    const company = await store.one("companies", { id: lorry.companyId });
    if (!company || company.rateCents <= 0)
      fail("This company has not set a tea rate yet. Choose another lorry.");
    const request = entity({
      ...input,
      requestNumber: await store.nextRequestNumber(Number(today().slice(0, 4))),
      ownerId: req.user.id,
      ownerName: req.user.name,
      ownerPhone: req.user.phone,
      companyId: company.id,
      companyName: company.name,
      companyPhone: company.phone,
      lorryId: lorry.id,
      vehicleNumber: lorry.vehicleNumber,
      rateCents: company.rateCents,
      status: "assigned",
    });
    const created = await store.create("requests", request);
    if (lorry.driverId)
      await notify(
        store,
        lorry.driverId,
        "new_assignment",
        "New pickup assignment",
        pickupDetails(request),
        created,
      );
    res.status(201).json(created);
  });
  api.patch("/requests/:id", role("owner"), async (req, res) => {
    const r = await store.one("requests", {
      id: req.params.id,
      ownerId: req.user.id,
    });
    if (!r) fail("Request not found.", 404);
    if (! ["pending", "requested"].includes(r.status))
      fail("Only pending requests can be edited.", 409);
    const lorry = await store.one("lorries", { id: r.lorryId });
    res.json(
      await store.update(
        "requests",
        r.id,
        await requestInput(req.body, lorry, r.id),
        { status: r.status },
      ),
    );
  });
  async function staffRequest(req) {
    const r = requireCompany(
      await store.one("requests", { id: req.params.id }),
      req.user,
    );
    if (req.user.role === "collector") {
      const lorry = await store.one("lorries", { id: r.lorryId });
      if (lorry?.driverId !== req.user.id) fail("Request not found.", 404);
    }
    return r;
  }
  api.post("/requests/:id/cancel", role("owner"), async (req, res) => {
    const r = await store.one("requests", {
      id: req.params.id,
      ownerId: req.user.id,
    });
    if (!r) fail("Request not found.", 404);
    if (! ["pending", "requested", "assigned"].includes(r.status))
      fail("Only pending requests can be cancelled.", 409);
    const updated = await store.update(
        "requests",
        r.id,
        { status: "cancelled", updatedAt: now() },
        { status: r.status },
      );
    await notifyCompanyUsers(
      store,
      r.companyId,
      "request_cancelled",
      "Collection cancelled",
      `The pickup for ${r.date} was cancelled by ${r.ownerName}.`,
      updated,
    );
    res.json(updated);
  });
  api.post("/requests/:id/reject", role("company"), async (req, res) => {
    const r = await staffRequest(req);
    assertTransition(r.status, "rejected");
    const updated = await store.update(
      "requests",
      r.id,
      { status: "rejected", updatedAt: now() },
      { status: r.status },
    );
    await notify(
      store,
      r.ownerId,
      "request_rejected",
      "Request rejected",
      `Your pickup request for ${r.date} was rejected.`,
      updated,
    );
    res.json(updated);
  });
  api.post(
    "/requests/:id/on-the-way",
    role("company", "collector"),
    async (req, res) => {
      const r = await staffRequest(req);
      assertTransition(r.status, "on_the_way");
      if (r.date > today())
        fail("This collection is scheduled for a future date.");
      const updated = await store.update(
          "requests",
          r.id,
          { status: "on_the_way", updatedAt: now() },
          { status: r.status },
        );
      await notify(store, r.ownerId, "lorry_on_the_way", "Lorry on the way", `The lorry ${r.vehicleNumber} is on the way for your pickup.`, updated);
      res.json(updated);
    },
  );
  api.post(
    "/requests/:id/collect",
    role("company", "collector"),
    async (req, res) => {
      const r = await staffRequest(req);
      assertTransition(r.status, "collected");
      if (r.date > today())
        fail("This collection is scheduled for a future date.");
      const bill = {
        ...calculateBill(
          scaled(req.body.grossWeight, "Gross weight", 3, 20000),
          scaled(req.body.rejectedWeight, "Rejected weight", 3, 20000),
          r.rateCents,
          scaled(req.body.otherDeduction, "Other deduction", 3, 20000),
        ),
        number: `BILL-${r.requestNumber}`,
        requestNumber: r.requestNumber,
        collectorName: req.user.name,
        pricePerKgAtCollection: r.rateCents,
        note: optional(req.body.note, "Bill note"),
        issuedAt: now(),
        recordedBy: req.user.name,
        paymentStatus: "unpaid",
      };
      const updated = await store.update(
        "requests",
        r.id,
        { status: "completed", bill, updatedAt: now() },
        { status: r.status },
      );
      await notify(
        store,
        r.ownerId,
        "collection_completed",
        "Collection completed",
        `Your tea collection on ${r.date} was completed.`,
        updated,
      );
      res.json(updated);
    },
  );
  api.post("/requests/:id/complete", role("company", "collector"), async (req, res) => {
    const r = await staffRequest(req);
    assertTransition(r.status, "completed");
    const updated = await store.update("requests", r.id, { status: "completed", updatedAt: now() }, { status: r.status });
    await notify(store, r.ownerId, "collection_completed", "Collection completed", `Your tea collection on ${r.date} was completed.`, updated);
    res.json(updated);
  });
  api.post("/requests/:id/pay", role("company"), async (req, res) => {
    const r = await staffRequest(req);
    if (!r.bill) fail("Generate the collection bill first.");
    assertTransition(r.status, "paid");
    if (r.bill.paymentStatus === "paid")
      fail("This bill is already marked paid.", 409);
    const settlement = (await store.list("settlements", { companyId: req.user.companyId }))
      .find((item) => item.requestIds.includes(r.id));
    const bill = {
      ...r.bill,
      paymentStatus: "paid",
      paidAt: now(),
      paidBy: req.user.name,
      paymentReference: text(
        req.body.reference,
        "Payment reference / cash receipt",
        { max: 100 },
      ),
      ...(settlement ? { settlementNumber: settlement.number } : {}),
    };
    const updated = await store.update("requests", r.id, { status: "paid", bill, updatedAt: now() }, { status: r.status });
    await notify(store, r.ownerId, "payment_completed", "Payment completed", `Payment for your tea collection on ${r.date} was completed.`, updated);
    res.json(updated);
  });
  api.post("/settlements", role("company"), async (req, res) => {
    const month = settlementMonth(req.body.month);
    const owner = await store.one("users", {
      id: typeof req.body.ownerId === "string" ? req.body.ownerId : "",
      role: "owner",
    });
    if (!owner) fail("Tea Seller not found.", 404);
    const company = await store.one("companies", { id: req.user.companyId });
    if (!company) fail("Company not found.", 404);
    const existing = await store.one("settlements", {
      companyId: company.id,
      ownerId: owner.id,
      month,
    });
    if (existing) fail("A monthly settlement already exists for this Tea Seller and month.", 409);
    const requests = (await store.list("requests", {
      companyId: company.id,
      ownerId: owner.id,
    })).filter(
      (request) =>
        request.date.startsWith(`${month}-`) &&
        request.bill &&
        ((request.status === "completed" && request.bill.paymentStatus === "unpaid") ||
          (request.status === "paid" && request.bill.paymentStatus === "paid")),
    );
    if (!requests.length)
      fail("There are no unpaid completed collections for this month.");
    const settlement = entity({
      number: `SET-${month}-${owner.id.slice(0, 8).toUpperCase()}`,
      companyId: company.id,
      ownerId: owner.id,
      ownerName: owner.name,
      companyName: company.name,
      month,
      requestIds: requests.map((request) => request.id),
      requestNumbers: requests.map((request) => request.requestNumber),
      requestCount: requests.length,
      totalCents: requests.reduce((sum, request) => sum + request.bill.totalCents, 0),
      status: requests.every((request) => request.bill.paymentStatus === "paid")
        ? "paid"
        : "pending",
    });
    const created = await store.create("settlements", settlement);
    await notify(
      store,
      owner.id,
      "monthly_payment_ready",
      "Monthly payment summary ready",
      requests.every((request) => request.bill.paymentStatus === "paid")
        ? `Your ${month} tea collection payments are recorded.`
        : `Your ${month} tea collection summary is ready for review.`,
      requests[0],
    );
    res.status(201).json(created);
  });
  api.post("/settlements/:id/pay", role("company"), async (req, res) => {
    const settlement = await store.one("settlements", {
      id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!settlement) fail("Monthly settlement not found.", 404);
    if (settlement.status === "paid") fail("This monthly settlement is already paid.", 409);
    const reference = text(req.body.reference, "Payment reference / cash receipt", { max: 100 });
    const paidAt = now();
    for (const requestId of settlement.requestIds) {
      const request = await store.one("requests", { id: requestId, companyId: req.user.companyId });
      if (!request || !["completed", "paid"].includes(request.status) || !request.bill)
        fail("One of the collections is no longer available for this settlement.", 409);
      if (request.status === "paid" || request.bill.paymentStatus === "paid") continue;
      await store.update(
        "requests",
        request.id,
        {
          status: "paid",
          updatedAt: paidAt,
          bill: {
            ...request.bill,
            paymentStatus: "paid",
            paidAt,
            paidBy: req.user.name,
            paymentReference: reference,
            settlementNumber: settlement.number,
          },
        },
        { status: "completed" },
      );
    }
    const updated = await store.update("settlements", settlement.id, {
      status: "paid",
      paymentReference: reference,
      paidAt,
      paidBy: req.user.name,
    });
    await notify(
      store,
      settlement.ownerId,
      "monthly_payment_completed",
      "Monthly payment completed",
      `Your ${settlement.month} tea collection payment has been completed.`,
      { id: settlement.id, requestNumber: settlement.number },
    );
    res.json(updated);
  });
  api.patch("/notifications/:id/read", async (req, res) => {
    const notification = await store.one("notifications", {
      id: req.params.id,
      recipientId: req.user.id,
    });
    if (!notification) fail("Notification not found.", 404);
    res.json(await store.update("notifications", notification.id, { read: true }, { recipientId: req.user.id }));
  });
  api.post("/notifications/read-all", async (req, res) => {
    const notifications = await store.list("notifications", { recipientId: req.user.id, read: false });
    await Promise.all(notifications.map((notification) => store.update("notifications", notification.id, { read: true }, { recipientId: req.user.id })));
    res.json({ ok: true });
  });
  api.use((req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  return api;
}

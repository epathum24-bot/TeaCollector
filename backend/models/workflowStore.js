import { createModels } from "./workflowModels.js";

const clean = (doc) => {
  if (!doc) return null;
  const { _id, __v, ...data } = doc;
  return JSON.parse(JSON.stringify(data));
};

// Keeps the demo API's small store interface while persisting through the
// current project's connected Mongoose database.
export function createWorkflowStore() {
  const models = createModels();
  const ready = (async () => {
    await Promise.all(Object.values(models).map((model) => model.init()));
    const legacyRequests = await models.requests
      .find({ $or: [{ requestNumber: { $exists: false } }, { requestNumber: null }] })
      .sort({ createdAt: 1 })
      .lean();
    for (const request of legacyRequests) {
      const year = Number(request.createdAt?.slice(0, 4)) || new Date().getFullYear();
      const sequence = await models.requestSequences.findOneAndUpdate(
        { year },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      const patch = {
        requestNumber: `TC-${year}-${String(sequence.value).padStart(4, "0")}`,
        ...(request.status === "requested" ? { status: "pending" } : {}),
      };
      await models.requests.updateOne(
        { _id: request._id, requestNumber: { $exists: false } },
        { $set: patch },
      );
    }
  })();
  return {
    mode: "mongo",
    ready,
    list: async (name, filter = {}) =>
      (await models[name].find(filter).lean()).map(clean),
    one: async (name, filter = {}) => {
      const query = models[name].findOne(filter);
      if (name === "users") query.select("+passwordHash");
      return clean(await query.lean());
    },
    create: async (name, data) =>
      clean((await models[name].create(data)).toObject()),
    update: async (name, id, patch, guard = {}) =>
      clean(
        await models[name]
          .findOneAndUpdate(
            { id, ...guard },
            { $set: patch },
            { new: true, runValidators: true },
          )
          .lean(),
      ),
    nextRequestNumber: async (year) => {
      const sequence = await models.requestSequences.findOneAndUpdate(
        { year },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      return `TC-${year}-${String(sequence.value).padStart(4, "0")}`;
    },
    remove: async (name, id) => models[name].deleteOne({ id }),
  };
}

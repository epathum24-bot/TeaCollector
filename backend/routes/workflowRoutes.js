import express from "express";
import { routes as createWorkflowApi } from "../controllers/workflowController.js";

export default function workflowRoutes(store, secret) {
  const router = express.Router();
  let writeQueue = Promise.resolve();

  router.use((req, res, next) => {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method))
      return next();
    const previous = writeQueue;
    let release;
    writeQueue = new Promise((resolve) => (release = resolve));
    previous.then(() => {
      const finish = () => release();
      res.once("finish", finish);
      res.once("close", finish);
      next();
    });
  });

  router.use(createWorkflowApi(store, secret));
  return router;
}

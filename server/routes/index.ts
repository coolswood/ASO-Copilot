import { Hono } from "hono";
import trackRoutes from "./track";
import keywordIdeasRoutes from "./keyword-ideas";
import searchRoutes from "./search";
import appsRoutes from "./apps";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.route("/track", trackRoutes);
app.route("/keyword-ideas", keywordIdeasRoutes);
app.route("/search", searchRoutes);
app.route("/apps", appsRoutes);

export default app;

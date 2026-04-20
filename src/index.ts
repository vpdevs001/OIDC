import express from "express";
import path from "node:path";
import authRoutes from "./routes/auth.routes";

const app = express();
const PORT = process.env.PORT ?? 8000;

app.use(express.json());
app.use(express.static(path.resolve("public")));

app.get("/health", (req, res) =>
  res.json({ message: "Server is healthy", healthy: true }),
);

app.use("/", authRoutes);

app.listen(PORT, () => {
  console.log(`AuthServer is running on PORT ${PORT}`);
});

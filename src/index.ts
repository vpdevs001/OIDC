import { createServer } from "node:http";
import "dotenv/config";
import createApplication from "./app/app.js";

const startServer = () => {
  const server = createServer(createApplication());
  const PORT = process?.env?.PORT;
  server.listen(PORT, () => {
    console.log("Server is running at PORT", PORT);
  });
};

startServer();

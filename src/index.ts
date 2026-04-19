import { createServer } from "http";
import { createApplication } from "./app/index.js";

async function main() {
  try {
    const server = createServer(createApplication());
    const PORT: number = 8000;

    server.listen(PORT, () => {
      console.log(`HTTP Server is running on PORT ${PORT}`);
    });
  } catch (error) {
    console.log(`Error starting HTTP Server`);
    throw error;
  }
}

main();

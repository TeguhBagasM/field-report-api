import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Server berjalan di http://localhost:${env.PORT}`);
});

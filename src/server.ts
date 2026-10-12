import { app } from "./app.js";
import { env } from "./config/env.js";
import { isServerless, warmupPool } from "./db/pool.js";

app.listen(env.PORT, () => {
  console.log(`Server berjalan di http://localhost:${env.PORT}`);
  // Warm-up SELECT 1 hanya untuk server biasa (koneksi persisten).
  // Di serverless (Vercel) dilewati: tidak ada proses listen yang persisten.
  if (!isServerless) {
    warmupPool()
      .then(() => console.log("DB warm-up OK (SELECT 1)"))
      .catch((e) => console.error("DB warm-up gagal:", e));
  }
});

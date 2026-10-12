// Entry khusus deployment serverless di Vercel.
// Vercel memanggil default export ini sebagai request handler untuk
// semua rute /api/* (diteruskan lewat rewrites di vercel.json).
// File ini di-bundle oleh Vercel, bukan oleh tsc lokal (di luar rootDir src),
// jadi import-nya tanpa ekstensi agar resolver bundler Vercel pasti cocok
// ke ../src/app.ts (beda dengan konvensi .js di dalam src/).
import { app } from "../src/app";

export default app;

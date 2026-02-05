// cleanup everything
import fs from "fs/promises";
import path from "path";

async function clean() {

    const previewDir = path.join(process.cwd(), "public", "previews");
    try {
        await fs.rm(previewDir, { recursive: true, force: true });
        console.log(`Cleaned previews directory: ${previewDir}`);
    } catch (err) {
        console.error(`Error cleaning previews directory: ${err}`);
    }

    const generatedDir = path.join(process.cwd(), "lib", "generated");
    try {
        await fs.rm(generatedDir, { recursive: true, force: true });
        console.log(`Cleaned generated directory: ${generatedDir}`);
    } catch (err) {
        console.error(`Error cleaning generated directory: ${err}`);
    }

    const outDir = path.join(process.cwd(), "out");
    try {
        await fs.rm(outDir, { recursive: true, force: true });
        console.log(`Cleaned Next.js export directory: ${outDir}`);
    } catch (err) {
        console.error(`Error cleaning Next.js export directory: ${err}`);
    }

    const nextDir = path.join(process.cwd(), ".next");
    try {
        await fs.rm(nextDir, { recursive: true, force: true });
        console.log(`Cleaned Next.js build directory: ${nextDir}`);
    } catch (err) {
        console.error(`Error cleaning Next.js build directory: ${err}`);
    }
}

clean().catch((err) => {
  console.error(err);
  process.exit(1);
});
// Builds the static demo catalog for hosting without a server (Vercel).
// Usage: node scripts/build-demo.js [path-to-ffmpeg]
// Writes public/demo/catalog.json and compressed images in public/demo/img/.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const ffmpeg = process.argv[2] || "ffmpeg";
const outDir = path.join(root, "public", "demo");
const imgDir = path.join(outDir, "img");
fs.mkdirSync(imgDir, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
const imageMap = new Map();

function demoImage(src) {
  if (!src || /^https?:/i.test(src)) return src;
  if (!imageMap.has(src)) {
    const name = `${imageMap.size + 1}.jpg`;
    // flatten transparency onto white, max 800px, ~80-150 KB
    execFileSync(ffmpeg, ["-v", "error", "-y", "-i", path.join(root, src),
      "-vf", "scale='min(800,iw)':-2,format=rgba,geq=r='r(X,Y)*alpha(X,Y)/255+255*(1-alpha(X,Y)/255)':g='g(X,Y)*alpha(X,Y)/255+255*(1-alpha(X,Y)/255)':b='b(X,Y)*alpha(X,Y)/255+255*(1-alpha(X,Y)/255)',format=yuvj420p",
      "-q:v", "4", path.join(imgDir, name)]);
    imageMap.set(src, `demo/img/${name}`);
  }
  return imageMap.get(src);
}

const products = catalog.products
  .filter((product) => product.isVisible !== false)
  .map((product) => ({
    ...product,
    image: demoImage(product.image),
    images: [...new Set((product.images || []).map(demoImage))],
  }));

fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify({
  categories: catalog.categories,
  products,
  banners: [],
  updatedAt: catalog.updatedAt,
}, null, 2));
console.log(`demo: ${products.length} products, ${imageMap.size} images`);

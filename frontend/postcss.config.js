const tailwindPlugin = await (async () => {
  try {
    await import("@tailwindcss/postcss");
    return "@tailwindcss/postcss";
  } catch {
    return "tailwindcss";
  }
})();

export default {
  plugins: {
    [tailwindPlugin]: {},
    autoprefixer: {},
  }
}

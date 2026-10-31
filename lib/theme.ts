// The theme choice, shared by the layout (server) and the toggle (browser).
export const THEME_KEY = "alienx.theme";
// Runs before the page paints, so a saved theme never flashes the other one first.
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

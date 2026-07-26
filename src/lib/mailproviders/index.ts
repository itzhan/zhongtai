// 副作用导入 —— 每加一个 provider, 在这里加一行 import 即可。
// 这是整个插件框架里【唯一】需要手改的地方。
import "./mock";
// import "./outlook";
// import "./firstmail";

export * from "./types";
export { getProvider, listProviders } from "./registry";

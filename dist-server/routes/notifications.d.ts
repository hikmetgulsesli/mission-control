declare const router: import("express-serve-static-core").Router;
declare function sendTelegram(message: string): Promise<boolean>;
export default router;
export { sendTelegram };

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { emailRouter } from "./email";
import { authRouter } from "./auth";
import { adminRouter } from "./admin";
import { userRouter } from "./user";
import { developerRouter } from "./developer";
import { webhookRouter } from "./webhook";
import { siteRouter } from "./site";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/email", emailRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/user", userRouter);
router.use("/developer", developerRouter);
router.use("/webhook", webhookRouter);
router.use("/site", siteRouter);

export default router;
